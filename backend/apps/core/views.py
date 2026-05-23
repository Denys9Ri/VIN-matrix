import requests
import base64
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from rest_framework.decorators import action
from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from django.utils import timezone
from datetime import datetime, timedelta, time as dt_time
from django.http import HttpResponse
from decimal import Decimal

from .models import Company, Visit, ServiceCatalog, Employee, OrderPart, OrderService, Category, InventoryItem, Supplier
from .serializers import (
    VisitSerializer, UserSerializer, 
    CompanySerializer, ServiceCatalogSerializer,
    OrderPartSerializer, OrderServiceSerializer,
    CategorySerializer, InventoryItemSerializer, SupplierSerializer
)

def get_user_company(user):
    if hasattr(user, 'company'): return user.company
    if hasattr(user, 'employee_profile'): return user.employee_profile.company
    return None

class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self): 
        company = get_user_company(self.request.user)
        queryset = Visit.objects.filter(company=company)
        if self.action != 'list': return queryset
        
        search = self.request.query_params.get('search', '').strip()
        date_str = self.request.query_params.get('date', '').strip()
        history_mode = self.request.query_params.get('history', '').strip()
        
        # 1. Режим повної історії
        if history_mode == 'true':
            if search:
                queryset = queryset.filter(Q(plate__icontains=search) | Q(vin_code__icontains=search) | Q(client__icontains=search) | Q(phone__icontains=search))
            return queryset.order_by('-created_at')

        # 2. Швидкий пошук авто на головній
        if search:
            queryset = queryset.filter(Q(plate__icontains=search) | Q(vin_code__icontains=search) | Q(client__icontains=search) | Q(phone__icontains=search))
            return queryset.order_by('-created_at')
            
        # 3. Фільтрація по днях СТО
        if date_str and len(date_str) == 10:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except Exception:
                target_date = timezone.localdate()
        else:
            target_date = timezone.localdate()
            
        start_of_day = timezone.make_aware(datetime.combine(target_date, dt_time.min))
        end_of_day = start_of_day + timedelta(days=1)

        queryset = queryset.filter(
            Q(scheduled_datetime__gte=start_of_day, scheduled_datetime__lt=end_of_day) |
            Q(scheduled_datetime__isnull=True, created_at__gte=start_of_day, created_at__lt=end_of_day)
        ).distinct()
        
        return queryset.order_by('scheduled_datetime' if date_str else '-created_at')

    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

    @action(detail=False, methods=['post'], url_path='recognize_document', parser_classes=[MultiPartParser, FormParser])
    def recognize_document(self, request):
        doc = request.FILES.get('document')
        if not doc:
            return Response({"error": "Файл не знайдено"}, status=400)
            
        try:
            image_data = doc.read()
            b64_image = base64.b64encode(image_data).decode('utf-8')
            
            response = requests.post(
                'https://api.ocr.space/parse/image',
                data={
                    'apikey': 'helloworld',  
                    'language': 'eng',       
                    'base64Image': 'data:image/jpeg;base64,' + b64_image,
                    'OCREngine': 2,          
                },
                timeout=20
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('IsErroredOnProcessing'):
                    err_msg = result.get('ErrorMessage', ['Невідома помилка OCR'])[0]
                    return Response({"error": f"ШІ відмовив: {err_msg}"}, status=400)
                
                parsed_text = ""
                for res in result.get('ParsedResults', []):
                    parsed_text += res.get('ParsedText', '') + " "
                    
                text_upper = parsed_text.upper().replace('\n', ' ').replace('\r', ' ')
                
                if not text_upper.strip():
                     return Response({"error": "ШІ не знайшов жодного тексту на фото."}, status=400)
                
                vin_match = re.search(r'\b[A-HJ-NPR-Z0-9]{17}\b', text_upper)
                vin_code = vin_match.group(0) if vin_match else ""
                
                plate_match = re.search(r'\b[A-ZІЇЄ]{2}\s*\d{4}\s*[A-ZІЇЄ]{2}\b', text_upper)
                plate = plate_match.group(0).replace(' ', '') if plate_match else ""
                
                brand = ""
                brands = ['HONDA', 'VOLKSWAGEN', 'BMW', 'AUDI', 'TOYOTA', 'RENAULT', 'SKODA', 'FORD', 'HYUNDAI', 'KIA', 'NISSAN', 'MERCEDES', 'PEUGEOT', 'MAZDA', 'LEXUS', 'CHEVROLET', 'MITSUBISHI', 'PORSCHE', 'SUBARU', 'SUZUKI', 'VOLVO', 'FIAT', 'TESLA', 'LAND ROVER', 'JEEP', 'ACURA', 'INFINITI', 'DODGE', 'CHRYSLER']
                for b in brands:
                    if b in text_upper:
                        brand = b
                        break

                model = ""
                model_match = re.search(r'D[\.\,\s]*3\s*[:\-]?\s*([A-Z0-9\-]+)', text_upper)
                if model_match:
                    model = model_match.group(1).strip()
                    if model.endswith(' E'): model = model[:-2]
                    if model == 'E': model = ""

                year = ""
                year_match = re.search(r'(?:B[\.\,\s]*[12]|YEAR|РІК)[^\d]{0,10}(\d{4})\b', text_upper)
                if year_match:
                    year = year_match.group(1)

                engine = ""
                engine_match = re.search(r'(?:[PРpрFf][\.\,\s]*1|СМ3|CM3|CAPACITY)[^\d]{0,10}(\d{3,4})\b', text_upper)
                if engine_match:
                    engine = engine_match.group(1)

                fuel = ""
                fuel_match = re.search(r'(?:[PРpрFf][\.\,\s]*3|FUEL|ПАЛИВА)[^A-ZА-Я0-9]{0,10}([A-ZА-Я0-9])\b', text_upper)
                if fuel_match:
                    f_char = fuel_match.group(1).upper()
                    if f_char in ['S', '5', 'C', 'С']: fuel = 'Газ/Бензин'
                    elif f_char in ['B', 'В', '8']: fuel = 'Бензин'
                    elif f_char in ['D', 'Д', '0', 'O', 'О']: fuel = 'Дизель'
                    elif f_char in ['E', 'Е']: fuel = 'Електро'
                    elif f_char in ['M', 'М']: fuel = 'Гібрид'

                return Response({
                    "success": True,
                    "plate": plate,
                    "vin_code": vin_code,
                    "brand": brand,
                    "model": model,
                    "year": year,
                    "engine": engine,
                    "fuel": fuel, 
                    "raw_text": text_upper
                })
            else:
                return Response({"error": "Помилка API розпізнавання"}, status=500)
                
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    # --- ГЕНЕРАЦІЯ PDF НА ПРЯМОМУ ШЛЯХУ ---
    @action(detail=True, methods=['get'], url_path='pdf')
    def export_pdf(self, request, pk=None):
        visit = self.get_object()
        company = visit.company

        # Парсимо дані авто з JSON
        car_data = {}
        if visit.delivery_data and visit.delivery_data.startswith('{'):
            try:
                import json
                car_data = json.loads(visit.delivery_data)
            except:
                pass
                
        brand = car_data.get('brand', '-')
        model = car_data.get('model', '')
        year = car_data.get('year', '-')
        mileage = car_data.get('mileage', '-')

        # Дані компанії
        comp_name = company.name if company and company.name else "АВТОСЕРВІС"
        comp_phone = company.phone if company and company.phone else ""
        comp_addr = company.address if company and company.address else ""
        footer_text = company.document_footer if company and company.document_footer else "Дякуємо, що обрали нас!"

        html_content = f"""
        <html>
        <head>
            <meta charset="utf-8">
            <title>Акт виконаних робіт №{visit.id}</title>
            <style>
                body {{ font-family: 'Arial', sans-serif; margin: 30px; color: #222; font-size: 14px; }}
                .header {{ display: flex; justify-content: space-between; margin-bottom: 25px; border-bottom: 2px solid #222; padding-bottom: 10px; }}
                .company-info {{ font-size: 13px; color: #555; width: 50%; float: left; }}
                .company-info h2 {{ margin: 0 0 5px 0; color: #222; }}
                .doc-title {{ text-align: right; width: 50%; float: right; }}
                .doc-title h2 {{ margin: 0 0 5px 0; }}
                .clearfix::after {{ content: ""; clear: both; display: table; }}
                .info-table {{ width: 100%; margin-bottom: 25px; border-collapse: collapse; clear: both; }}
                .info-table td {{ padding: 8px; border: 1px solid #bbb; }}
                .items-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
                .items-table th, .items-table td {{ padding: 10px; border: 1px solid #999; text-align: left; }}
                .items-table th {{ background-color: #f2f2f2; font-weight: bold; }}
                .total {{ text-align: right; margin-top: 30px; font-size: 18px; font-weight: bold; color: #000; }}
                .signatures {{ margin-top: 60px; width: 100%; }}
                .signatures td {{ border: none; padding: 10px; }}
                .footer {{ margin-top: 40px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }}
            </style>
        </head>
        <body onload="window.print()">
            <div class="header clearfix">
                <div class="company-info">
                    <h2>{comp_name}</h2>
                    <p>{comp_addr}<br>{comp_phone}</p>
                </div>
                <div class="doc-title">
                    <h2>АКТ ВИКОНАНИХ РОБІТ № {visit.id}</h2>
                    <p>Дата: {visit.created_at.strftime('%d.%m.%Y %H:%M')}</p>
                </div>
            </div>
            
            <table class="info-table">
                <tr>
                    <td><strong>Автомобіль:</strong> {brand} {model} ({year})</td>
                    <td><strong>Держ. номер:</strong> {visit.plate}</td>
                </tr>
                <tr>
                    <td><strong>VIN-код:</strong> {getattr(visit, 'vin_code', '-')}</td>
                    <td><strong>Пробіг:</strong> {mileage} км</td>
                </tr>
                <tr>
                    <td colspan="2"><strong>Власник (Клієнт):</strong> {getattr(visit, 'client', '-')} | Тел: {getattr(visit, 'phone', '-')}</td>
                </tr>
            </table>

            <h3>1. Виконані роботи та послуги</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Назва роботи (послуги)</th>
                        <th>К-сть / Нормо-години</th>
                        <th>Ціна за од. (UAH)</th>
                        <th>Сума (UAH)</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        total_amount = Decimal('0.00')
        services = getattr(visit, 'services', getattr(visit, 'orderservice_set', None))
        services_all = services.all() if services else []
        
        if services_all:
            for s in services_all:
                name = getattr(s, 'name', getattr(s, 'custom_name', 'Послуга'))
                qty = Decimal(str(getattr(s, 'quantity', 1)))
                price = Decimal(str(getattr(s, 'price', 0)))
                subtotal = price * qty
                total_amount += subtotal
                html_content += f"""
                    <tr>
                        <td>{name}</td>
                        <td>{qty}</td>
                        <td>{price}</td>
                        <td>{subtotal}</td>
                    </tr>
                """
        else:
            html_content += "<tr><td colspan='4' style='text-align:center; color:#777;'>Послуги відсутні</td></tr>"

        html_content += """
                </tbody>
            </table>

            <h3>2. Використані автозапчастини та розхідні матеріали</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Виробник (Бренд)</th>
                        <th>Артикул деталі</th>
                        <th>Найменування</th>
                        <th>Сума (UAH)</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        parts = getattr(visit, 'parts', getattr(visit, 'items', getattr(visit, 'orderpart_set', None)))
        parts_all = parts.all() if parts else []
        
        if parts_all:
            for p in parts_all:
                name = getattr(p, 'name', 'Запчастина')
                brand_part = getattr(p, 'brand', '')
                article = getattr(p, 'article', getattr(p, 'part_number', ''))
                sell_price = Decimal(str(getattr(p, 'sell_price', getattr(p, 'price', 0))))
                total_amount += sell_price
                html_content += f"""
                    <tr>
                        <td>{brand_part}</td>
                        <td>{article}</td>
                        <td>{name}</td>
                        <td>{sell_price}</td>
                    </tr>
                """
        else:
            html_content += "<tr><td colspan='4' style='text-align:center; color:#777;'>Запчастини не додавалися</td></tr>"

        html_content += f"""
                </tbody>
            </table>

            <div class="total">Разом до сплати: {total_amount} UAH</div>
            
            <table class="signatures">
                <tr>
                    <td>Представник Виконавця: _________________</td>
                    <td style="text-align: right;">Замовник: _________________</td>
                </tr>
            </table>

            <div class="footer">{footer_text}</div>
        </body>
        </html>
        """
        return HttpResponse(html_content, content_type='text/html; charset=utf-8')

class OrderPartViewSet(viewsets.ModelViewSet):
    serializer_class = OrderPartSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return OrderPart.objects.filter(visit__company=get_user_company(self.request.user))
    def perform_create(self, serializer):
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=get_user_company(self.request.user))
        serializer.save(visit=visit)

class OrderServiceViewSet(viewsets.ModelViewSet):
    serializer_class = OrderServiceSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return OrderService.objects.filter(visit__company=get_user_company(self.request.user))
    def perform_create(self, serializer):
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=get_user_company(self.request.user))
        serializer.save(visit=visit)

class ServiceCatalogViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return ServiceCatalog.objects.filter(company=get_user_company(self.request.user))
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    def get(self, request):
        company = get_user_company(request.user)
        role = 'owner' if hasattr(request.user, 'company') else 'mechanic'
        
        permissions = {"can_create_visits": True, "can_view_finances": True}
        if role == 'mechanic':
            emp = request.user.employee_profile
            permissions = {
                "can_create_visits": emp.can_create_visits,
                "can_view_finances": emp.can_view_finances
            }
            
        user_serializer = UserSerializer(request.user)
        company_serializer = CompanySerializer(company, context={'request': request})
        return Response({ "user": user_serializer.data, "company": company_serializer.data, "role": role, "permissions": permissions })
    
    def patch(self, request):
        if not hasattr(request.user, 'company'): return Response({"error": "Тільки власник"}, status=403)
        user = request.user
        company = user.company
        first_name = request.data.get('user[first_name]') or request.data.get('first_name')
        email = request.data.get('user[email]') or request.data.get('email')
        if first_name: user.first_name = first_name
        if email: user.email = email
        user.save()
        
        name = request.data.get('company[name]') or request.data.get('name')
        if name: company.name = name
        if 'company[phone]' in request.data: company.phone = request.data.get('company[phone]')
        if 'company[address]' in request.data: company.address = request.data.get('company[address]')
        if 'company[document_footer]' in request.data: company.document_footer = request.data.get('company[document_footer]')
        if 'company[global_margin_percent]' in request.data: company.global_margin_percent = request.data.get('company[global_margin_percent]')
        
        if 'company[business_type]' in request.data:
            company.business_type = request.data.get('company[business_type]')
        
        if 'company[euro_rate]' in request.data:
            raw_rate = str(request.data.get('company[euro_rate]')).replace(',', '.')
            try:
                company.euro_rate = float(raw_rate)
            except ValueError:
                pass
                
        logo = request.data.get('company[logo]')
        if logo: company.logo = logo
        company.save()
        return Response({"message": "Дані успішно оновлено!"})

class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    def list(self, request):
        if not hasattr(request.user, 'company'): return Response(status=403)
        mechanics = Employee.objects.filter(company=request.user.company, role='mechanic')
        data = [{
            "id": m.user.id, 
            "username": m.user.username, 
            "first_name": m.user.first_name,
            "can_create_visits": m.can_create_visits,
            "can_view_finances": m.can_view_finances
        } for m in mechanics]
        return Response(data)
        
    def create(self, request):
        if not hasattr(request.user, 'company'): return Response(status=403)
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name')
        can_create = request.data.get('can_create_visits') == True
        can_view = request.data.get('can_view_finances') == True
        
        if User.objects.filter(username=username).exists(): return Response({"error": "Логін зайнятий"}, status=400)
        try:
            user = User.objects.create_user(username=username, password=password, first_name=first_name)
            Employee.objects.create(user=user, company=request.user.company, role='mechanic', can_create_visits=can_create, can_view_finances=can_view)
            return Response({"message": "Створено"}, status=201)
        except Exception as e: return Response({"error": str(e)}, status=500)
        
    def partial_update(self, request, pk=None):
        if not hasattr(request.user, 'company'): return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=request.user.company)
            emp = user.employee_profile
            
            if request.data.get('first_name'): user.first_name = request.data.get('first_name')
            if request.data.get('new_password'): user.set_password(request.data.get('new_password'))
            user.save()
            
            if 'can_create_visits' in request.data: emp.can_create_visits = request.data.get('can_create_visits') == True
            if 'can_view_finances' in request.data: emp.can_view_finances = request.data.get('can_view_finances') == True
            emp.save()
            
            return Response({"message": "Оновлено"})
        except User.DoesNotExist: return Response(status=404)
        
    def destroy(self, request, pk=None):
        if not hasattr(request.user, 'company'): return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=request.user.company)
            user.delete()
            return Response({"message": "Видалено"})
        except User.DoesNotExist: return Response(status=404)

class RegisterView(APIView):
    permission_classes = [AllowAny] 
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        company_name = request.data.get('company_name')
        if not username or not password or not company_name: return Response({"error": "Всі поля обов'язкові!"}, status=400)
        if User.objects.filter(username=username).exists(): return Response({"error": "Логін зайнятий!"}, status=400)
        try:
            user = User.objects.create_user(username=username, password=password)
            company = Company.objects.create(name=company_name, owner=user)
            
            Supplier.objects.create(company=company, name="Vesna-auto", api_key="")
            Supplier.objects.create(company=company, name="Omega", api_key="")
            Supplier.objects.create(company=company, name="Technomir", api_key="")
            
            return Response({"message": "Успішно зареєстровано!"}, status=201)
        except Exception as e: return Response({"error": str(e)}, status=500)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Вихід успішний"}, status=205)
        except Exception as e: return Response({"error": "Помилка при виході"}, status=400)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        if not request.user.check_password(old_password): return Response({"error": "Старий пароль невірний"}, status=400)
        request.user.set_password(new_password)
        request.user.save()
        return Response({"message": "Пароль змінено!"}, status=200)

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return Category.objects.filter(company=get_user_company(self.request.user))
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): 
        queryset = InventoryItem.objects.filter(company=get_user_company(self.request.user))
        cat_id = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if cat_id: queryset = queryset.filter(category_id=cat_id)
        if search: queryset = queryset.filter(Q(article__icontains=search) | Q(name__icontains=search) | Q(brand__icontains=search))
        return queryset
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    def get_queryset(self): return Supplier.objects.filter(company=get_user_company(self.request.user))
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

    @action(detail=True, methods=['post'], url_path='fetch_warehouses')
    def fetch_warehouses(self, request, pk=None):
        sup = self.get_object()
        if not sup.api_key:
            return Response({"error": "Немає ключа API"}, status=400)

        if 'vesna' in sup.name.lower() or 'весна' in sup.name.lower():
            try:
                parts = sup.api_key.split(':')
                customer_id = int(parts[0]) if len(parts) > 1 else 0
                token_raw = parts[1] if len(parts) > 1 else sup.api_key
                token = token_raw.replace('Token', '').replace('token', '').strip()

                vesna_url = "https://api.vesna-auto.com.ua/public-api/search-methods/search-by-article/"
                headers = {"Authorization": f"Token {token}", "Content-Type": "application/json", "Accept-Language": "uk"}
                payload = {"customer_id": customer_id, "article": "111697"} 
                
                response = requests.post(vesna_url, json=payload, headers=headers, timeout=10)
                if response.status_code == 200:
                    raw_data = response.json()
                    if isinstance(raw_data, dict) and 'data' in raw_data: items_data = raw_data['data']
                    elif isinstance(raw_data, list): items_data = raw_data
                    else: items_data = [raw_data]

                    warehouses_dict = {}
                    for item in items_data:
                        if not isinstance(item, dict): continue
                        for wh in item.get('balance', []):
                            w_id = str(wh.get('warehouse_id', ''))
                            w_name = str(wh.get('name', 'Невідомий'))
                            if w_id:
                                warehouses_dict[w_id] = w_name

                    if not warehouses_dict:
                        return Response({"error": "API не повернуло жодного складу. Додайте їх вручну."}, status=400)
                    
                    existing_prefs = sup.warehouse_prefs if isinstance(sup.warehouse_prefs, list) else []
                    existing_map = {str(w.get('id')): w for w in existing_prefs if isinstance(w, dict) and w.get('id')}
                    
                    new_prefs = []
                    for w_id, w_name in warehouses_dict.items():
                        if w_id in existing_map:
                            pref = existing_map[w_id]
                            pref['name'] = w_name
                            new_prefs.append(pref)
                        else:
                            new_prefs.append({"id": w_id, "name": w_name, "priority": 99, "is_active": True})
                    
                    new_ids = {p['id'] for p in new_prefs}
                    for p in existing_prefs:
                        if str(p.get('id')) not in new_ids:
                            new_prefs.append(p)
                            
                    sup.warehouse_prefs = new_prefs
                    sup.save()
                    return Response({"message": f"Успішно завантажено {len(warehouses_dict)} складів!", "warehouses": new_prefs})
                return Response({"error": f"Помилка API ({response.status_code}): {response.text}"}, status=400)
            except Exception as e:
                return Response({"error": str(e)}, status=500)
                
        elif 'omega' in sup.name.lower() or 'омега' in sup.name.lower():
            try:
                omega_url = "https://public.omega.page/public/api/v1.0/product/search"
                payload = {
                    "Key": sup.api_key.strip(),
                    "SearchPhrase": "111697", 
                    "From": 0,
                    "Count": 100
                }
                
                response = requests.post(omega_url, json=payload, timeout=10)
                if response.status_code == 200:
                    raw_data = response.json()
                    items_data = raw_data.get('Result', []) or raw_data.get('Data', [])
                    
                    warehouses_dict = {}
                    for item in items_data:
                        for wh in item.get('Rests', []):
                            w_name = str(wh.get('Key', 'Склад Омега')).strip()
                            if w_name: warehouses_dict[w_name] = w_name
                                
                        for wh in item.get('SupplierRests', []):
                            w_name = str(wh.get('WareHouseName', 'Склад Партнера')).strip()
                            if w_name: warehouses_dict[w_name] = w_name

                    if not warehouses_dict:
                        return Response({"error": "API Омеги не повернуло складів. Спробуйте додати їх вручну."}, status=400)
                    
                    existing_prefs = sup.warehouse_prefs if isinstance(sup.warehouse_prefs, list) else []
                    existing_map = {str(w.get('id')): w for w in existing_prefs if isinstance(w, dict) and w.get('id')}
                    
                    new_prefs = []
                    for w_id, w_name in warehouses_dict.items():
                        if w_id in existing_map:
                            pref = existing_map[w_id]
                            pref['name'] = w_name
                            new_prefs.append(pref)
                        else:
                            new_prefs.append({"id": w_id, "name": w_name, "priority": 99, "is_active": True})
                            
                    new_ids = {p['id'] for p in new_prefs}
                    for p in existing_prefs:
                        if str(p.get('id')) not in new_ids:
                            new_prefs.append(p)
                            
                    sup.warehouse_prefs = new_prefs
                    sup.save()
                    return Response({"message": f"Успішно завантажено {len(warehouses_dict)} складів!", "warehouses": new_prefs})
                return Response({"error": f"Помилка API ({response.status_code}): {response.text}"}, status=400)
            except Exception as e:
                return Response({"error": str(e)}, status=500)

        elif 'tehnomir' in sup.name.lower() or 'техномир' in sup.name.lower():
            try:
                tehnomir_url = "https://api.tehnomir.com.ua/info/getSuppliers"
                payload = {"apiToken": sup.api_key.strip()}
                
                response = requests.post(tehnomir_url, json=payload, timeout=10)
                if response.status_code == 200:
                    raw_data = response.json()
                    items_data = raw_data.get('data', [])
                    
                    warehouses_dict = {}
                    for item in items_data:
                        w_id = str(item.get('priceLogo', '')).strip()
                        region = str(item.get('regionUa') or item.get('region') or '').strip()
                        if w_id:
                            warehouses_dict[w_id] = f"{w_id} ({region})" if region else w_id

                    if not warehouses_dict:
                        return Response({"error": "API Техномир не повернуло складів. Додайте їх вручну."}, status=400)
                    
                    existing_prefs = sup.warehouse_prefs if isinstance(sup.warehouse_prefs, list) else []
                    existing_map = {str(w.get('id')): w for w in existing_prefs if isinstance(w, dict) and w.get('id')}
                    
                    new_prefs = []
                    for w_id, w_name in warehouses_dict.items():
                        if w_id in existing_map:
                            pref = existing_map[w_id]
                            pref['name'] = w_name
                            new_prefs.append(pref)
                        else:
                            new_prefs.append({"id": w_id, "name": w_name, "priority": 99, "is_active": True})
                            
                    new_ids = {p['id'] for p in new_prefs}
                    for p in existing_prefs:
                        if str(p.get('id')) not in new_ids:
                            new_prefs.append(p)
                            
                    sup.warehouse_prefs = new_prefs
                    sup.save()
                    return Response({"message": f"Успішно завантажено {len(warehouses_dict)} складів/напрямків!", "warehouses": new_prefs})
                return Response({"error": f"Помилка API ({response.status_code}): {response.text}"}, status=400)
            except Exception as e:
                return Response({"error": str(e)}, status=500)

        return Response({"error": "Автоматичне завантаження не підтримується для цього постачальника. Додайте склади вручну."}, status=400)

    @action(detail=True, methods=['get'], url_path='part_info')
    def part_info(self, request, pk=None):
        base_sup = self.get_object()
        company = base_sup.company
        all_suppliers = Supplier.objects.filter(company=company).exclude(api_key='')
        article = request.query_params.get('article', '').strip()
        brand = request.query_params.get('brand', '').strip().upper()
        sku_param = request.query_params.get('sku', '').strip()
        
        info_data = {"properties": [], "applicability": [], "images": []}
        if not article: return Response(info_data)

        seen_props = set()
        seen_apps = set()
        seen_images = set()

        def add_prop(name, val):
            if not name or not val: return
            k = f"{name}:{val}".lower().strip()
            if k not in seen_props:
                info_data['properties'].append({"name": str(name), "value": str(val)})
                seen_props.add(k)

        def add_app(val):
            if not val: return
            k = str(val).strip()
            if k.lower() not in seen_apps:
                info_data['applicability'].append(k)
                seen_apps.add(k.lower())

        def add_img(url):
            if not url: return
            if url not in seen_images:
                info_data['images'].append(url)
                seen_images.add(url)

        def fetch_tehno(sup):
            try:
                brand_url = "https://api.tehnomir.com.ua/info/getBrandsByCode"
                b_res = requests.post(brand_url, json={"apiToken": sup.api_key.strip(), "code": article}, timeout=5)
                brand_id = None
                if b_res.status_code == 200 and b_res.json().get('success'):
                    for b in b_res.json().get('data', []):
                        if str(b.get('brand', '')).upper() == brand:
                            brand_id = b.get('brandId')
                            break
                    if not brand_id and len(b_res.json().get('data', [])) > 0:
                        brand_id = b_res.json().get('data')[0].get('brandId')
                if brand_id:
                    info_url = "https://api.tehnomir.com.ua/info/getProductInfo"
                    info_res = requests.post(info_url, json={"apiToken": sup.api_key.strip(), "brandId": brand_id, "code": article}, timeout=10)
                    if info_res.status_code == 200 and info_res.json().get('success'):
                        data = info_res.json().get('data', {})
                        for prop in data.get('properties', []):
                            add_prop(prop.get('name', ''), prop.get('value', ''))
                        for img in data.get('images', []):
                            add_img(img.get('image', ''))
            except Exception: pass

        def fetch_omega(sup):
            try:
                prod_id = None
                
                is_valid_sku = False
                if sku_param:
                    try:
                        prod_id = int(sku_param)
                        is_valid_sku = True
                    except ValueError:
                        pass
                
                if not is_valid_sku:
                    search_url = "https://public.omega.page/public/api/v1.0/product/search"
                    res = requests.post(search_url, json={"Key": sup.api_key.strip(), "SearchPhrase": article, "From": 0, "Count": 10}, timeout=5)
                    
                    if res.status_code == 200:
                        items = res.json().get('Result', []) or res.json().get('Data', [])
                        for item in items:
                            if str(item.get('BrandDescription', '')).upper() == brand:
                                prod_id = int(item.get('ProductId', 0))
                                add_img(item.get('ImageUrl', ''))
                                if item.get('Weight'): add_prop("Вага (кг)", item.get('Weight'))
                                if item.get('Info'): add_prop("Додатково", item.get('Info'))
                                desc = str(item.get('Description', ''))
                                if 'пр-во' in desc:
                                    cars_str = desc.split('(пр-во')[0].replace('Фильтр масляный двигателя', '').replace('Колодки тормозные', '').strip()
                                    if cars_str:
                                        for c in cars_str.split(','): add_app(c.strip())
                                break

                if prod_id:
                    details_url = "https://public.omega.page/public/api/v1.0/product/details"
                    det_res = requests.post(details_url, json={"Key": sup.api_key.strip(), "ProductIdList": [prod_id]}, timeout=10)
                    if det_res.status_code == 200:
                        data_list = det_res.json().get('Data', [])
                        if data_list:
                            prod_data = data_list[0]
                            for spec in prod_data.get('SpecificationList', []):
                                add_prop(spec.get('Descr') or spec.get('Key', ''), spec.get('Value', ''))
                            oe_codes = prod_data.get('OECodeList', [])
                            if oe_codes:
                                add_prop("Оригінальні (OE) коди", ", ".join([f"{oe.get('Code')} ({oe.get('CarModel', '')})" for oe in oe_codes]))
                            for app in prod_data.get('ApplicabilityList', []):
                                brand_name = app.get('Name', '')
                                children = app.get('Children', [])
                                if children:
                                    for child in children: add_app(f"{brand_name} {child.get('Name', '')}")
                                else:
                                    add_app(brand_name)
            except Exception: pass

        def fetch_vesna(sup):
             try:
                 parts = sup.api_key.split(':')
                 customer_id = int(parts[0]) if len(parts) > 1 else 0
                 token = (parts[1] if len(parts) > 1 else sup.api_key).replace('Token', '').replace('token', '').strip()
                 vesna_url = "https://api.vesna-auto.com.ua/public-api/search-methods/search-by-article/"
                 headers = {"Authorization": f"Token {token}", "Content-Type": "application/json", "Accept-Language": "uk"}
                 res = requests.post(vesna_url, json={"customer_id": customer_id, "article": article}, headers=headers, timeout=5)
                 
                 if res.status_code == 200:
                     raw_data = res.json()
                     items_data = raw_data.get('data', []) if isinstance(raw_data, dict) else (raw_data if isinstance(raw_data, list) else [])
                     for item in items_data:
                         if str(item.get('brand', '')).upper() == brand:
                             add_img(item.get('image') or item.get('picture') or '')
                             break
             except Exception: pass

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            for sup in all_suppliers:
                if 'omega' in sup.name.lower() or 'омега' in sup.name.lower(): futures.append(executor.submit(fetch_omega, sup))
                elif 'tehnomir' in sup.name.lower() or 'техномир' in sup.name.lower(): futures.append(executor.submit(fetch_tehno, sup))
                elif 'vesna' in sup.name.lower() or 'весна' in sup.name.lower(): futures.append(executor.submit(fetch_vesna, sup))
            for future in as_completed(futures): pass

        return Response(info_data)


# ===============================================
# ОСНОВНИЙ КЛАС ПОШУКУ
# ===============================================
class PartSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_user_company(request.user)
        euro_rate = float(company.euro_rate) if company.euro_rate else 42.00
        
        query = request.query_params.get('q', '').strip()
        is_analog = request.query_params.get('analog') == 'true'
        sup_id = request.query_params.get('supplier_id')
        sku_param = request.query_params.get('sku', '').strip() 
        orig_brand = request.query_params.get('brand', '').strip().upper() 
        
        q_clean = query.upper().replace(' ', '').replace('-', '').replace('.', '')
        
        if not query or len(query) < 2: return Response([])

        results = []

        if not is_analog:
            local_items = InventoryItem.objects.filter(
                Q(company=company) & 
                (Q(article__icontains=query) | Q(name__icontains=query) | Q(brand__icontains=query))
            )
            for item in local_items:
                results.append({
                    "id": f"local_{item.id}", "supplier_id": "local", "source": "Мій склад", "brand": item.brand, "article": item.article,
                    "name": item.name, "buy_price": float(item.buy_price), "quantity": f"{item.quantity} шт",
                    "is_local": True, "sku": "", "min_qty": 1, "image_url": "", "description": "",
                    "warehouses": [{"name": "Мій склад", "quantity": f"{item.quantity} шт", "priority": 1, "buy_price": float(item.buy_price)}]
                })

        suppliers = Supplier.objects.filter(company=company)
        if is_analog and sup_id:
            suppliers = suppliers.filter(id=sup_id) 
        
        for sup in suppliers:
            prefs = sup.warehouse_prefs if isinstance(sup.warehouse_prefs, list) else []
            prefs_map = {str(p.get('id')): p for p in prefs if isinstance(p, dict)}
            prefs_map.update({str(p.get('name')).lower(): p for p in prefs if isinstance(p, dict)})

            # === VESNA ===
            if sup.api_key and ('vesna' in sup.name.lower() or 'весна' in sup.name.lower()):
                try:
                    parts = sup.api_key.split(':')
                    customer_id = int(parts[0]) if len(parts) > 1 else 0
                    token_raw = parts[1] if len(parts) > 1 else sup.api_key
                    token = token_raw.replace('Token', '').replace('token', '').strip()
                    
                    vesna_url = "https://api.vesna-auto.com.ua/public-api/search-methods/search-by-cross/" if is_analog else "https://api.vesna-auto.com.ua/public-api/search-methods/search-by-article/"
                    
                    headers = {"Authorization": f"Token {token}", "Content-Type": "application/json", "Accept-Language": "uk"}
                    payload = {"customer_id": customer_id, "article": query}
                    response = requests.post(vesna_url, json=payload, headers=headers, timeout=15)
                    
                    if response.status_code == 200:
                        raw_data = response.json()
                        items_data = raw_data.get('data', []) if isinstance(raw_data, dict) else (raw_data if isinstance(raw_data, list) else [])
                        for item in items_data:
                            if not isinstance(item, dict): continue
                            
                            item_sku = str(item.get('sku', ''))
                            if is_analog and item_sku == sku_param:
                                continue
                                
                            balances = item.get('balance', [])
                            if not balances: continue
                            warehouses_list = []
                            
                            eur_price = float(item.get('price', 0) or 0)
                            uah_price = round(eur_price * euro_rate, 2)
                            
                            for wh in balances:
                                wh_id, wh_name = str(wh.get('warehouse_id', '')), str(wh.get('name', 'Склад'))
                                pref = prefs_map.get(wh_id) or prefs_map.get(wh_name.lower())
                                if pref and not pref.get('is_active', True): continue
                                warehouses_list.append({
                                    "name": wh_name, 
                                    "quantity": wh.get('quantity', '0'), 
                                    "priority": int(pref.get('priority', 99)) if pref else 99,
                                    "buy_price": uah_price
                                })
                                
                            if not warehouses_list: continue
                            warehouses_list.sort(key=lambda w: (0 if float(str(w['quantity']).replace('>', '').replace('+', '') or 0) > 0 else 1, w['priority']))
                            
                            results.append({
                                "id": f"vesna_{sup.id}_{item.get('sku', '0')}", "supplier_id": sup.id, "source": sup.name, "brand": item.get('brand', 'Unknown'),
                                "article": item.get('article', query.upper()), "name": item.get('name', 'Деталь Vesna'),
                                "buy_price": uah_price, "quantity": f"{warehouses_list[0]['quantity']} шт ({warehouses_list[0]['name']})",
                                "is_local": False, "warehouses": warehouses_list, "sku": item.get('sku', ''), "min_qty": item.get('min_order_quantity', 1),
                                "image_url": item.get('image') or item.get('picture') or '', "description": item.get('description') or ''
                            })
                except Exception: pass

            # === OMEGA ===
            elif sup.api_key and ('omega' in sup.name.lower() or 'омега' in sup.name.lower()):
                try:
                    if is_analog:
                        is_valid_sku = False
                        try:
                            prod_id_int = int(sku_param)
                            is_valid_sku = True
                        except ValueError:
                            pass

                        if sku_param and is_valid_sku:
                            cross_url = "https://public.omega.page/public/api/v1.0/product/getAllCrosses"
                            payload = {"Key": sup.api_key.strip(), "ProductId": prod_id_int}
                            
                            response = requests.post(cross_url, json=payload, timeout=15)
                            
                            if response.status_code == 200:
                                crosses = response.json().get('Data', [])
                                seen_codes = set()
                                valid_crosses = []
                                
                                for cross in crosses:
                                    cross_code = str(cross.get('Code', '')).upper().replace(' ','').replace('-','').replace('.','')
                                    cross_brand = str(cross.get('Brand', '')).upper()
                                    
                                    unique_key = f"{cross_code}_{cross_brand}"
                                    if unique_key in seen_codes:
                                        continue
                                        
                                    seen_codes.add(unique_key)
                                    valid_crosses.append(cross)
                                
                                def get_omega_price(cross_data):
                                    c_code_raw = str(cross_data.get('Code', ''))
                                    c_brand_raw = str(cross_data.get('Brand', 'Unknown'))
                                    
                                    price_url = "https://public.omega.page/public/api/v1.0/product/search"
                                    price_payload = {"Key": sup.api_key.strip(), "SearchPhrase": c_code_raw, "From": 0, "Count": 5}
                                    
                                    try:
                                        price_res = requests.post(price_url, json=price_payload, timeout=5)
                                        if price_res.status_code == 200:
                                            res_items = price_res.json().get('Result', []) or price_res.json().get('Data', [])
                                            best_match = None
                                            for match_item in res_items:
                                                prod_id = str(match_item.get('ProductId', '0'))
                                                if prod_id == sku_param:
                                                    continue
                                                best_match = match_item
                                                break
                                                
                                            if best_match:
                                                buy_price = float(best_match.get('CustomerPrice') or best_match.get('EffectivePrice') or best_match.get('Price') or 0)
                                                prod_name = best_match.get('Description', 'TecDoc Аналог')
                                                prod_id = str(best_match.get('ProductId', '0'))
                                                img_url = best_match.get('ImageUrl', '')
                                                
                                                wh_list = []
                                                for wh in best_match.get('Rests', []):
                                                    wh_name, wh_qty = str(wh.get('Key', 'Склад Омега')), str(wh.get('Value', '0'))
                                                    pref = prefs_map.get(wh_name) or prefs_map.get(wh_name.lower())
                                                    if pref and not pref.get('is_active', True): continue
                                                    wh_list.append({"name": wh_name, "quantity": wh_qty, "priority": int(pref.get('priority', 99)) if pref else 99, "buy_price": buy_price})
                                                    
                                                for wh in best_match.get('SupplierRests', []):
                                                    wh_name, wh_qty = str(wh.get('WareHouseName', 'Склад Партнера')), str(wh.get('Rest', '0'))
                                                    pref = prefs_map.get(wh_name) or prefs_map.get(wh_name.lower())
                                                    if pref and not pref.get('is_active', True): continue
                                                    wh_list.append({"name": wh_name, "quantity": wh_qty, "priority": int(pref.get('priority', 99)) if pref else 99, "buy_price": buy_price})
                                                
                                                if wh_list:
                                                    wh_list.sort(key=lambda w: (0 if float(str(w['quantity']).replace('>', '').replace('+', '') or 0) > 0 else 1, w['priority']))
                                                    return {
                                                        "id": f"omega_cross_{sup.id}_{prod_id}", "supplier_id": sup.id, "source": sup.name,
                                                        "brand": c_brand_raw, "article": c_code_raw,
                                                        "name": prod_name, "buy_price": buy_price, 
                                                        "quantity": f"{wh_list[0]['quantity']} шт ({wh_list[0]['name']})",
                                                        "is_local": False, "warehouses": wh_list, "sku": prod_id,
                                                        "min_qty": 1, "image_url": img_url, "description": ""
                                                    }
                                    except Exception:
                                        pass
                                        
                                    return {
                                        "id": f"omega_cross_{sup.id}_nostock_{c_code_raw}", "supplier_id": sup.id, "source": sup.name,
                                        "brand": c_brand_raw, "article": c_code_raw,
                                        "name": "TecDoc Аналог (Клікніть артикул для пошуку)", "buy_price": 0, 
                                        "quantity": "Немає в наявності",
                                        "is_local": False, "warehouses": [{"name": "База Омега", "quantity": "0", "priority": 99, "buy_price": 0}], "sku": "",
                                        "min_qty": 1, "image_url": "", "description": ""
                                    }

                                with ThreadPoolExecutor(max_workers=10) as executor:
                                    future_to_cross = {executor.submit(get_omega_price, c): c for c in valid_crosses[:50]}
                                    for future in as_completed(future_to_cross):
                                        res = future.result()
                                        if res:
                                            results.append(res)
                    else:
                        omega_url = "https://public.omega.page/public/api/v1.0/product/search"
                        payload = {"Key": sup.api_key.strip(), "SearchPhrase": query, "From": 0, "Count": 50}
                        
                        response = requests.post(omega_url, json=payload, timeout=10)
                        
                        if response.status_code == 200:
                            raw_data = response.json()
                            items_data = raw_data.get('Result', []) or raw_data.get('Data', [])
                            
                            for item in items_data:
                                if not isinstance(item, dict): continue
                                
                                art_val = str(item.get('Number', '')).upper().replace(' ','').replace('-','').replace('.','')
                                card_val = str(item.get('Card', '')).upper().replace(' ','').replace('-','').replace('.','')
                                
                                if q_clean not in art_val and q_clean not in card_val:
                                    continue
                                    
                                warehouses_list = []
                                buy_price = float(item.get('CustomerPrice') or item.get('EffectivePrice') or item.get('Price') or 0)
                                
                                for wh in item.get('Rests', []):
                                    wh_name, wh_qty = str(wh.get('Key', 'Склад Омега')), str(wh.get('Value', '0'))
                                    pref = prefs_map.get(wh_name) or prefs_map.get(wh_name.lower())
                                    if pref and not pref.get('is_active', True): continue
                                    warehouses_list.append({"name": wh_name, "quantity": wh_qty, "priority": int(pref.get('priority', 99)) if pref else 99, "buy_price": buy_price})
                                    
                                for wh in item.get('SupplierRests', []):
                                    wh_name, wh_qty = str(wh.get('WareHouseName', 'Склад Партнера')), str(wh.get('Rest', '0'))
                                    pref = prefs_map.get(wh_name) or prefs_map.get(wh_name.lower())
                                    if pref and not pref.get('is_active', True): continue
                                    warehouses_list.append({"name": wh_name, "quantity": wh_qty, "priority": int(pref.get('priority', 99)) if pref else 99, "buy_price": buy_price})
                                
                                if not warehouses_list: continue
                                warehouses_list.sort(key=lambda w: (0 if float(str(w['quantity']).replace('>', '').replace('+', '') or 0) > 0 else 1, w['priority']))
                                
                                results.append({
                                    "id": f"omega_{sup.id}_{item.get('ProductId', '0')}", "supplier_id": sup.id, "source": sup.name,
                                    "brand": item.get('BrandDescription', 'Unknown'), "article": item.get('Number', query.upper()),
                                    "name": item.get('Description', 'Деталь Omega'), "buy_price": buy_price, 
                                    "quantity": f"{warehouses_list[0]['quantity']} шт ({warehouses_list[0]['name']})",
                                    "is_local": False, "warehouses": warehouses_list, "sku": str(item.get('ProductId', '')),
                                    "min_qty": 1, "image_url": item.get('ImageUrl', ''), "description": item.get('DescriptionUkr', '') or item.get('Info', '')
                                })
                except Exception: pass

            # === TECHNOMIR ===
            elif sup.api_key and ('tehnomir' in sup.name.lower() or 'техномир' in sup.name.lower()):
                try:
                    payload = {
                        "apiToken": sup.api_key.strip(),
                        "code": query,
                        "isShowAnalogs": 1 if is_analog else 0, 
                        "currency": "UAH" 
                    }
                    
                    if is_analog:
                        brand_url = "https://api.tehnomir.com.ua/info/getBrandsByCode"
                        b_res = requests.post(brand_url, json={"apiToken": sup.api_key.strip(), "code": query}, timeout=10)
                        
                        brand_id = None
                        if b_res.status_code == 200 and b_res.json().get('success'):
                            for b in b_res.json().get('data', []):
                                if str(b.get('brand', '')).upper() == orig_brand:
                                    brand_id = b.get('brandId')
                                    break
                            if not brand_id and len(b_res.json().get('data', [])) > 0:
                                brand_id = b_res.json().get('data')[0].get('brandId') 
                        
                        if brand_id:
                            payload['brandId'] = brand_id
                    
                    tehnomir_url = "https://api.tehnomir.com.ua/price/search"
                    response = requests.post(tehnomir_url, json=payload, timeout=25)
                    
                    if response.status_code == 200:
                        raw_data = response.json()
                        if not raw_data.get('success'):
                            continue
                            
                        items_data = raw_data.get('data', [])
                        
                        for item in items_data:
                            if not isinstance(item, dict): continue
                            
                            brand = str(item.get('brand', 'Unknown')).upper()
                            article = str(item.get('code', query.upper()))
                            prod_id = str(item.get('productId', '0'))
                            
                            art_clean = article.upper().replace(' ', '').replace('-', '').replace('.', '')
                            
                            if not is_analog:
                                if q_clean not in art_clean:
                                    continue
                            else:
                                if prod_id == sku_param:
                                    continue 
                                
                            warehouses_list = []
                            for rest in item.get('rests', []):
                                w_code = str(rest.get('priceLogo', 'Склад'))
                                days = int(rest.get('deliveryTime', 0) or 0)
                                w_name = f"{w_code} ({days} дн.)"
                                w_qty = str(rest.get('quantity', '1'))
                                
                                pref = prefs_map.get(w_code) or prefs_map.get(w_code.lower())
                                is_active = True
                                priority = 99
                                
                                if pref:
                                    is_active = pref.get('is_active', True)
                                    priority = int(pref.get('priority', 99))
                                    
                                if not is_active: continue
                                
                                rest_price = float(rest.get('price', 0))
                                currency = str(rest.get('currency', 'UAH')).upper()
                                if currency == 'EUR':
                                    rest_price = round(rest_price * euro_rate, 2)
                                elif currency == 'USD':
                                    rest_price = round(rest_price * 40.0, 2) 
                                    
                                is_ukraine = False
                                region_text = w_code.lower()
                                if days <= 3 or 'украин' in region_text or 'ua' in region_text or 'київ' in region_text or 'наше' in region_text:
                                    is_ukraine = True
                                    
                                warehouses_list.append({
                                    "name": w_name, 
                                    "quantity": w_qty, 
                                    "priority": priority, 
                                    "buy_price": rest_price,
                                    "is_ukraine": is_ukraine
                                })
                                
                            if not warehouses_list: continue
                            
                            warehouses_list.sort(key=lambda w: (0 if w.get('is_ukraine') else 1, w['buy_price'], w['priority']))
                            cheapest_wh = warehouses_list[0]
                            
                            results.append({
                                "id": f"tehno_{sup.id}_{prod_id}_{brand}_{cheapest_wh['name']}", 
                                "supplier_id": sup.id, "source": sup.name,
                                "brand": brand, 
                                "article": article,
                                "name": item.get('descriptionRus') or item.get('descriptionUa') or 'Деталь Technomir', 
                                "buy_price": cheapest_wh['buy_price'], 
                                "quantity": f"{cheapest_wh['quantity']} шт ({cheapest_wh['name']})",
                                "is_local": False, 
                                "warehouses": warehouses_list, 
                                "sku": prod_id,
                                "min_qty": 1, "image_url": "", "description": ""
                            })
                except Exception: pass
                    
        return Response(results)
