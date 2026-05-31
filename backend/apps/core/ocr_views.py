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

MODEL_STOP_WORDS = [
    'COMMERCIAL', 'DESCRIPTION', 'DESCRІPTION', 'MAKE', 'TYPE', 'VEHICLE', 'IDENTIFICATION',
    'NUMBER', 'MAXIMUM', 'MASS', 'CATEGORY', 'BODY', 'CAPACITY', 'FUEL', 'COLOR', 'SPECIAL',
    'ОПИС', 'КОМЕРЦІЙНИЙ', 'МАРКА', 'ТИП', 'ІДЕНТИФІКАЦІЙНИЙ', 'НОМЕР', 'КУЗОВ', 'КОЛІР',
]


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


def detect_document_side(text):
    back_markers = len(re.findall(r'\b(?:D|E|F|G|J|P|R|S)[\.\,\s]*[1234]?\b', text, re.IGNORECASE))
    back_words = len(re.findall(r'MAKE|TYPE|COMMERCIAL|VIN|CHASSIS|CAPACITY|POWER|FUEL|BODY|COLOR|МАРКА|ТИП|ОБ[\W_]*ЄМ|ПОТУЖНІСТЬ|ПАЛИВО', text, re.IGNORECASE))
    front_markers = len(re.findall(r'\b(?:A|B|C)[\.\,\s]*[1234]?\b', text, re.IGNORECASE))
    front_words = len(re.findall(r'REGISTRATION|CERTIFICATE|DATE OF FIRST|YEAR OF MANUFACTURE|SURNAME|GIVEN NAMES|ADDRESS|РЕЄСТРАЦ|СВІДОЦТВО|РІК ВИПУСКУ|ПРІЗВИЩЕ|АДРЕСА', text, re.IGNORECASE))

    if back_markers + back_words >= front_markers + front_words + 2:
        return 'back'
    if front_markers + front_words >= back_markers + back_words + 2:
        return 'front'
    return 'unknown'


def parse_vin(text):
    compact = compact_text(text)
    match = re.search(r'[A-HJ-NPR-Z0-9]{17}', compact)
    return match.group(0) if match else ''


def parse_vin_candidate(text):
    compact = compact_text(text)
    match = re.search(r'[A-HJ-NPR-Z0-9]{12,16}', compact)
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


def clean_model(value):
    value = re.sub(r'\s+', ' ', (value or '').upper()).strip(' :-,.;')
    if not value:
        return ''
    for stop_word in MODEL_STOP_WORDS:
        index = value.find(stop_word)
        if index > 0:
            value = value[:index].strip(' :-,.;')
    value = re.split(r'\s{2,}|\b[A-ZА-ЯІЇЄҐ][\.\,]?\d\b', value)[0].strip(' :-,.;')
    tokens = value.split()
    if len(tokens) > 3:
        value = ' '.join(tokens[:3])
    return value[:40]


def parse_model(text):
    patterns = [
        r'D[\.\,\s]*3\s*[:\-]?\s*([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9\-\s]{1,45})',
        r'(?:MODEL|МОДЕЛЬ)\s*[:\-]?\s*([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9\-\s]{1,45})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = clean_model(match.group(1))
            if value and value not in ['E', 'Є']:
                return value
    return ''


def parse_year(text):
    # Important: never take a random 19xx/20xx number as year.
    # In Ukrainian registration certificates engine volume may be 1997/1998 and must not become the car year.
    patterns = [
        r'(?:B[\.\,\s]*2|YEAR\s+OF\s+MANUFACTURE|РІК\s+ВИПУСКУ)[^0-9]{0,20}(19\d{2}|20\d{2})',
        r'(?:B[\.\,\s]*1|DATE\s+OF\s+FIRST\s+REGISTRATION|ДАТА\s+ПЕРШОЇ\s+РЕЄСТРАЦІЇ)[^0-9]{0,30}(?:\d{1,2}[\.\-/]\d{1,2}[\.\-/])?(19\d{2}|20\d{2})',
    ]
    return first_realistic_number(patterns, text, 1980, 2035)


def parse_engine_volume(text):
    return first_realistic_number([
        r'(?:P|Р)[\.\,\s]*1\b[^0-9]{0,18}(\d{3,4})\b',
        r'(?:CM3|СМ3|CМ3|СM3|CUBIC|CAPACITY|ОБ[\W_]*ЄМ)[^0-9]{0,18}(\d{3,4})\b',
        r'(\d{3,4})\s*(?:CM3|СМ3|CМ3|СM3)\b',
    ], text, 500, 8000)


def parse_engine_power(text):
    return first_realistic_number([
        r'(?:P|Р)[\.\,\s]*2\b[^0-9]{0,18}(\d{2,4}(?:[\.,]\d)?)\b',
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

    match = re.search(r'(?:P|Р|F)[\.\,\s]*3\b[^A-ZА-ЯІЇЄҐ0-9]{0,10}([A-ZА-ЯІЇЄҐ0-9])\b', text, re.IGNORECASE)
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


def field_source(document_side, field):
    if field in ['plate', 'year']:
        return 'front' if document_side in ['front', 'unknown'] else 'back_low_priority'
    if field in ['vin_code', 'brand', 'model', 'engine_volume', 'engine_power', 'engine_code', 'fuel']:
        return 'back' if document_side in ['back', 'unknown'] else 'front_low_priority'
    return document_side


def parse_document_text(raw_text):
    text = normalized_text(raw_text)
    document_side = detect_document_side(text)
    vin_code = parse_vin(text)
    vin_candidate = '' if vin_code else parse_vin_candidate(text)
    engine_volume = parse_engine_volume(text)
    engine_power = parse_engine_power(text)
    engine_code = parse_engine_code(text, vin_code)
    fuel = parse_fuel(text)
    plate = parse_plate(text)
    brand = parse_brand(text)
    model = parse_model(text)
    year = parse_year(text)

    warnings = []
    if vin_candidate and not vin_code:
        warnings.append('VIN схожий на неповний. Перевірте вручну.')
    if document_side == 'back' and year:
        warnings.append('Рік знайдено на другій стороні — перевірте, щоб це не був обʼєм двигуна.')
    if document_side == 'front' and engine_volume:
        warnings.append('Обʼєм двигуна знайдено на першій стороні — перевірте вручну.')

    return {
        'success': True,
        'document_side': document_side,
        'plate': plate,
        'vin_code': vin_code,
        'vin_candidate': vin_candidate,
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
            'plate': confidence(plate, 'high' if document_side != 'back' else 'medium'),
            'vin_code': confidence(vin_code, 'high' if len(vin_code) == 17 else 'none'),
            'brand': confidence(brand, 'high' if document_side != 'front' else 'medium'),
            'model': confidence(model, 'medium'),
            'year': confidence(year, 'high' if document_side != 'back' else 'low'),
            'engine_volume': confidence(engine_volume, 'high' if document_side != 'front' else 'low'),
            'engine_power': confidence(engine_power, 'high' if document_side != 'front' else 'low'),
            'engine_code': confidence(engine_code, 'low'),
            'fuel': confidence(fuel, 'high' if document_side != 'front' else 'medium'),
        },
        'sources': {
            'plate': field_source(document_side, 'plate'),
            'vin_code': field_source(document_side, 'vin_code'),
            'brand': field_source(document_side, 'brand'),
            'model': field_source(document_side, 'model'),
            'year': field_source(document_side, 'year'),
            'engine_volume': field_source(document_side, 'engine_volume'),
            'engine_power': field_source(document_side, 'engine_power'),
            'engine_code': field_source(document_side, 'engine_code'),
            'fuel': field_source(document_side, 'fuel'),
        },
        'warnings': warnings,
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
