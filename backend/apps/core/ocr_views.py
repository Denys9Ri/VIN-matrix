import base64
import os
import re

import requests
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


OCR_URL = 'https://api.ocr.space/parse/image'

BRANDS = [
    'VOLKSWAGEN', 'MERCEDES-BENZ', 'MERCEDES', 'LAND ROVER', 'RENAULT', 'TOYOTA',
    'HONDA', 'BMW', 'AUDI', 'SKODA', 'FORD', 'HYUNDAI', 'KIA', 'NISSAN', 'PEUGEOT',
    'MAZDA', 'LEXUS', 'CHEVROLET', 'MITSUBISHI', 'PORSCHE', 'SUBARU', 'SUZUKI',
    'VOLVO', 'FIAT', 'TESLA', 'JEEP', 'ACURA', 'INFINITI', 'DODGE', 'CHRYSLER',
    'OPEL', 'CITROEN', 'SEAT', 'MINI', 'SMART', 'DAEWOO', 'CHERY', 'GEELY', 'HAVAL',
]

PLATE_TRANSLATION = str.maketrans({
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'І': 'I', 'К': 'K',
    'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X', 'У': 'Y',
})


def normalized_text(value):
    return re.sub(r'\s+', ' ', (value or '').upper().replace('\n', ' ').replace('\r', ' ')).strip()


def compact_text(value):
    return re.sub(r'[^A-ZА-ЯІЇЄҐ0-9]', '', normalized_text(value))


def confidence(found, level='high'):
    return level if found else 'none'


def first_realistic_number(patterns, text, min_value, max_value):
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            raw = (match.group(1) or '').replace(',', '.').strip()
            try:
                number = float(raw)
            except ValueError:
                continue
            if min_value <= number <= max_value:
                return raw.rstrip('0').rstrip('.') if '.' in raw else raw
    return ''


def parse_vin(text):
    compact = compact_text(text)
    match = re.search(r'[A-HJ-NPR-Z0-9]{17}', compact)
    return match.group(0) if match else ''


def parse_plate(text):
    compact = compact_text(text).translate(PLATE_TRANSLATION)
    match = re.search(r'[ABCEHIKMOPTX]{2}\d{4}[ABCEHIKMOPTX]{2}', compact)
    return match.group(0) if match else ''


def parse_brand(text):
    for brand in BRANDS:
        if brand in text:
            return brand
    return ''


def parse_model(text):
    patterns = [
        r'D[\.\,\s]*3\s*[:\-]?\s*([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9\-\s]{1,35})',
        r'(?:MODEL|МОДЕЛЬ)\s*[:\-]?\s*([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9\-\s]{1,35})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = re.split(r'\s{2,}|\b[A-ZА-ЯІЇЄҐ][\.\,]?\d\b', match.group(1).strip())[0].strip(' :-,.;')
            if value and value not in ['E', 'Є']:
                return value[:40]
    return ''


def parse_year(text):
    focused = first_realistic_number([
        r'(?:B[\.\,\s]*1|B[\.\,\s]*2|YEAR|РІК|ДАТА ВИПУСКУ)[^0-9]{0,16}(19\d{2}|20\d{2})',
    ], text, 1980, 2035)
    if focused:
        return focused
    for match in re.finditer(r'\b(19\d{2}|20\d{2})\b', text):
        year = int(match.group(1))
        if 1980 <= year <= 2035:
            return str(year)
    return ''


def parse_engine_volume(text):
    return first_realistic_number([
        r'(?:P|Р)[\.\,\s]*1[^0-9]{0,18}(\d{3,4})\b',
        r'(?:CM3|СМ3|CМ3|СM3|CUBIC|CAPACITY|ОБ[\W_]*ЄМ|ОБ[\W_]*ЕМ)[^0-9]{0,18}(\d{3,4})\b',
        r'(\d{3,4})\s*(?:CM3|СМ3|CМ3|СM3)\b',
    ], text, 500, 8000)


def parse_engine_power(text):
    return first_realistic_number([
        r'(?:P|Р)[\.\,\s]*2[^0-9]{0,18}(\d{2,4}(?:[\.,]\d)?)\b',
        r'(?:KW|КВТ|KWT|POWER|ПОТУЖНІСТЬ)[^0-9]{0,18}(\d{2,4}(?:[\.,]\d)?)\b',
        r'(\d{2,4}(?:[\.,]\d)?)\s*(?:KW|КВТ)\b',
    ], text, 20, 1000)


def parse_engine_code(text, vin_code=''):
    patterns = [
        r'(?:ENGINE\s*(?:NO|NUMBER|CODE)|MOTOR\s*(?:NO|NUMBER|CODE)|КОД\s*ДВИГУНА|НОМЕР\s*ДВИГУНА|ДВИГУН\s*№)[^A-ZА-ЯІЇЄҐ0-9]{0,12}([A-ZА-ЯІЇЄҐ0-9\-]{4,20})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = match.group(1).strip(' :-,.;')
            if value and value != vin_code and not re.fullmatch(r'\d{3,4}', value):
                return value[:20]
    return ''


def parse_fuel(text):
    if re.search(r'БЕНЗИН|PETROL|GASOLINE', text):
        return 'Бензин'
    if re.search(r'ДИЗЕЛ|DIESEL', text):
        return 'Дизель'
    if re.search(r'ГАЗ|LPG|CNG', text):
        return 'Газ/Бензин'
    if re.search(r'ЕЛЕКТРО|ELECTRIC', text):
        return 'Електро'
    if re.search(r'ГІБРИД|HYBRID', text):
        return 'Гібрид'

    match = re.search(r'(?:P|Р|F)[\.\,\s]*3[^A-ZА-ЯІЇЄҐ0-9]{0,10}([A-ZА-ЯІЇЄҐ0-9])\b', text, re.IGNORECASE)
    if not match:
        return ''
    char = match.group(1).upper()
    if char in ['S', '5', 'C', 'С']:
        return 'Газ/Бензин'
    if char in ['B', 'В', '8']:
        return 'Бензин'
    if char in ['D', 'Д', '0', 'O', 'О']:
        return 'Дизель'
    if char in ['E', 'Е']:
        return 'Електро'
    if char in ['M', 'М']:
        return 'Гібрид'
    return ''


def parse_document_text(raw_text):
    text = normalized_text(raw_text)
    vin_code = parse_vin(text)
    engine_volume = parse_engine_volume(text)
    engine_power = parse_engine_power(text)
    engine_code = parse_engine_code(text, vin_code)
    fuel = parse_fuel(text)
    plate = parse_plate(text)
    brand = parse_brand(text)
    model = parse_model(text)
    year = parse_year(text)

    return {
        'success': True,
        'plate': plate,
        'vin_code': vin_code,
        'brand': brand,
        'model': model,
        'year': year,
        'engine': engine_volume,
        'engine_volume': engine_volume,
        'engine_power': engine_power,
        'engine_code': engine_code,
        'fuel': fuel,
        'engine_review_status': 'needs_review',
        'quality': 'good' if len(text) > 180 and (vin_code or plate) else 'medium' if len(text) > 60 else 'low',
        'confidence': {
            'plate': confidence(plate, 'high'),
            'vin_code': confidence(vin_code, 'high'),
            'brand': confidence(brand, 'medium'),
            'model': confidence(model, 'medium'),
            'year': confidence(year, 'high'),
            'engine_volume': confidence(engine_volume, 'low'),
            'engine_power': confidence(engine_power, 'low'),
            'engine_code': confidence(engine_code, 'low'),
            'fuel': confidence(fuel, 'medium'),
        },
        'raw_text': text,
    }


class RecognizeDocumentView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        document = request.FILES.get('document')
        if not document:
            return Response({'success': False, 'error': 'Файл не знайдено.'}, status=status.HTTP_400_BAD_REQUEST)

        api_key = os.getenv('OCR_SPACE_API_KEY', '').strip()
        if not api_key or api_key.lower() == 'helloworld':
            return Response({
                'success': False,
                'error': 'OCR API ключ не налаштований. Додайте OCR_SPACE_API_KEY у змінні середовища backend.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        languages_env = os.getenv('OCR_SPACE_LANGUAGES') or os.getenv('OCR_SPACE_LANGUAGE') or 'ukr,eng'
        languages = [lang.strip() for lang in languages_env.split(',') if lang.strip()] or ['ukr', 'eng']
        engine = os.getenv('OCR_SPACE_ENGINE', '2').strip() or '2'

        image_data = document.read()
        b64_image = base64.b64encode(image_data).decode('utf-8')
        best_text = ''
        best_language = languages[0]
        last_error = ''

        for language in languages:
            try:
                response = requests.post(
                    OCR_URL,
                    data={
                        'apikey': api_key,
                        'language': language,
                        'base64Image': 'data:image/jpeg;base64,' + b64_image,
                        'OCREngine': engine,
                        'scale': 'true',
                        'detectOrientation': 'true',
                        'isTable': 'true',
                    },
                    timeout=35,
                )
                if response.status_code != 200:
                    last_error = f'OCR API повернув статус {response.status_code}'
                    continue

                result = response.json()
                if result.get('IsErroredOnProcessing'):
                    message = result.get('ErrorMessage') or result.get('ErrorDetails') or 'Невідома помилка OCR'
                    if isinstance(message, list):
                        message = ', '.join(str(item) for item in message)
                    last_error = str(message)
                    continue

                text = ' '.join((item.get('ParsedText') or '') for item in result.get('ParsedResults', []))
                if len(text.strip()) > len(best_text.strip()):
                    best_text = text
                    best_language = language

                parsed = parse_document_text(text)
                if parsed.get('vin_code') or parsed.get('plate'):
                    best_text = text
                    best_language = language
                    break
            except requests.RequestException as exc:
                last_error = str(exc)

        if not best_text.strip():
            return Response({
                'success': False,
                'error': last_error or 'OCR не знайшов текст. Спробуйте зробити фото ближче, без блиску і щоб документ займав більшу частину кадру.'
            }, status=status.HTTP_400_BAD_REQUEST)

        parsed = parse_document_text(best_text)
        parsed['ocr_language'] = best_language
        parsed['ocr_engine'] = engine
        return Response(parsed, status=status.HTTP_200_OK)
