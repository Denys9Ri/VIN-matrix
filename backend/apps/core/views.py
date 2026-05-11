import requests
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
        
        if history_mode == 'true':
            if search:
                queryset = queryset.filter(Q(plate__icontains=search) | Q(vin_code__icontains=search) | Q(client__icontains=search) | Q(phone__icontains=search))
            return queryset.order_by('-created_at')

        if search:
            queryset = queryset.filter(Q(plate__icontains=search) | Q(vin_code__icontains=search) | Q(client__icontains=search) | Q(phone__icontains=search))
            return queryset.order_by('-created_at')
            
        elif date_str and len(date_str) == 10:
            try:
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                start_of_day = timezone.make_aware(datetime.combine(parsed_date, dt_time.min))
                end_of_day = start_of_day + timedelta(days=1)
                queryset = queryset.filter((Q(scheduled_datetime__gte=start_of_day) & Q(scheduled_datetime__lt=end_of_day)) | (Q(scheduled_datetime__isnull=True) & Q(created_at__gte=start_of_day) & Q(created_at__lt=end_of_day))).distinct()
                return queryset.order_by('scheduled_datetime')
            except Exception: pass
                
        today = timezone.localdate()
        start_of_today = timezone.make_aware(datetime.combine(today, dt_time.min))
        end_of_today = start_of_today + timedelta(days=1)

        queryset = queryset.filter(
            ( ~Q(status='DONE') & Q(scheduled_datetime__lt=end_of_today) ) | 
            ( ~Q(status='DONE') & Q(scheduled_datetime__isnull=True) ) | 
            ( Q(status='DONE') & Q(updated_at__gte=start_of_today) & Q(updated_at__lt=end_of_today) ) 
        ).distinct()
        return queryset.order_by('scheduled_datetime') 

    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

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
        user_serializer = UserSerializer(request.user)
        company_serializer = CompanySerializer(company, context={'request': request})
        return Response({ "user": user_serializer.data, "company": company_serializer.data, "role": role })
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
        logo = request.data.get('company[logo]')
        if logo: company.logo = logo
        company.save()
        return Response({"message": "Дані успішно оновлено!"})

class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    def list(self, request):
        if not hasattr(request.user, 'company'): return Response(status=403)
        mechanics = Employee.objects.filter(company=request.user.company, role='mechanic')
        data = [{"id": m.user.id, "username": m.user.username, "first_name": m.user.first_name} for m in mechanics]
        return Response(data)
    def create(self, request):
        if not hasattr(request.user, 'company'): return Response(status=403)
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name')
        if User.objects.filter(username=username).exists(): return Response({"error": "Логін зайнятий"}, status=400)
        try:
            user = User.objects.create_user(username=username, password=password, first_name=first_name)
            Employee.objects.create(user=user, company=request.user.company, role='mechanic')
            return Response({"message": "Створено"}, status=201)
        except Exception as e: return Response({"error": str(e)}, status=500)
    def partial_update(self, request, pk=None):
        if not hasattr(request.user, 'company'): return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=request.user.company)
            if request.data.get('first_name'): user.first_name = request.data.get('first_name')
            if request.data.get('new_password'): user.set_password(request.data.get('new_password'))
            user.save()
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
            Company.objects.create(name=company_name, owner=user)
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

        # === ЛОГІКА VESNA-AUTO ===
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
                
        # === ЛОГІКА ОМЕГА АВТОПОСТАВКА ===
        elif 'omega' in sup.name.lower() or 'омега' in sup.name.lower():
            try:
                omega_url = "https://public.omega.page/public/api/v1.0/product/pricelist/paged"
                payload = {
                    "Key": sup.api_key.strip(),
                    "Number": "111697", # ХАК: Тепер ми передаємо тестовий артикул в Number
                    "From": 0,
                    "Count": 500
                }
                
                response = requests.post(omega_url, json=payload, timeout=10)
                if response.status_code == 200:
                    raw_data = response.json()
                    items_data = raw_data.get('Result', [])
                    
                    warehouses_dict = {}
                    for item in items_data:
                        for wh in item.get('Rests', []):
                            w_name = str(wh.get('Key', 'Склад Омега')).strip()
                            if w_name: warehouses_dict[w_name] = w_name
                                
                        for wh in item.get('SupplierRests', []):
                            w_name = str(wh.get('WareHouseName', 'Склад Партнера')).strip()
                            if w_name: warehouses_dict[w_name] = w_name

                    if not warehouses_dict:
                        return Response({"error": "API Омеги не повернуло складів. Додайте їх вручну."}, status=400)
                    
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

        return Response({"error": "Автоматичне завантаження не підтримується для цього постачальника. Додайте склади вручну."}, status=400)


class PartSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_user_company(request.user)
        query = request.query_params.get('q', '').strip()

        if not query or len(query) < 2:
            return Response([])

        results = []

        local_items = InventoryItem.objects.filter(
            Q(company=company) & 
            (Q(article__icontains=query) | Q(name__icontains=query) | Q(brand__icontains=query))
        )
        for item in local_items:
            results.append({
                "id": f"local_{item.id}",
                "source": "Мій склад",
                "brand": item.brand,
                "article": item.article,
                "name": item.name,
                "buy_price": float(item.buy_price),
                "quantity": f"{item.quantity} шт",
                "is_local": True,
                "sku": "",
                "min_qty": 1,
                "image_url": "",
                "description": ""
            })

        suppliers = Supplier.objects.filter(company=company)
        
        for sup in suppliers:
            prefs = sup.warehouse_prefs if isinstance(sup.warehouse_prefs, list) else []
            prefs_map = {}
            for p in prefs:
                if isinstance(p, dict):
                    if p.get('id'): prefs_map[str(p['id'])] = p
                    if p.get('name'): prefs_map[str(p['name']).lower()] = p

            # === ІНТЕГРАЦІЯ VESNA-AUTO ===
            if sup.api_key and ('vesna' in sup.name.lower() or 'весна' in sup.name.lower()):
                try:
                    parts = sup.api_key.split(':')
                    customer_id = int(parts[0]) if len(parts) > 1 else 0
                    token_raw = parts[1] if len(parts) > 1 else sup.api_key
                    token = token_raw.replace('Token', '').replace('token', '').strip()

                    vesna_url = "https://api.vesna-auto.com.ua/public-api/search-methods/search-by-article/"
                    headers = {"Authorization": f"Token {token}", "Content-Type": "application/json", "Accept-Language": "uk"}
                    payload = {"customer_id": customer_id, "article": query}
                    
                    response = requests.post(vesna_url, json=payload, headers=headers, timeout=10)
                    
                    if response.status_code == 200:
                        raw_data = response.json()
                        if isinstance(raw_data, dict) and 'data' in raw_data: items_data = raw_data['data']
                        elif isinstance(raw_data, list): items_data = raw_data
                        else: items_data = [raw_data]
                            
                        for item in items_data:
                            if not isinstance(item, dict): continue
                            balances = item.get('balance', [])
                            if not balances: continue
                            
                            warehouses_list = []
                            for wh in balances:
                                wh_id = str(wh.get('warehouse_id', ''))
                                wh_name = str(wh.get('name', 'Склад'))
                                
                                pref = prefs_map.get(wh_id) or prefs_map.get(wh_name.lower())
                                is_active = True
                                priority = 99
                                
                                if pref:
                                    is_active = pref.get('is_active', True)
                                    priority = int(pref.get('priority', 99))
                                    
                                if not is_active: continue
                                
                                warehouses_list.append({
                                    "name": wh_name,
                                    "quantity": wh.get('quantity', '0'),
                                    "priority": priority
                                })
                            
                            if not warehouses_list: continue
                            
                            def sort_warehouses(w):
                                raw_qty = str(w['quantity']).replace('>', '').replace('<', '').replace('+', '').strip()
                                try: qty = float(raw_qty)
                                except ValueError: qty = 1 if raw_qty else 0
                                has_stock = qty > 0
                                return (0 if has_stock else 1, w['priority'])
                                
                            warehouses_list.sort(key=sort_warehouses)
                            primary_wh = warehouses_list[0]
                            display_qty = f"{primary_wh['quantity']} шт ({primary_wh['name']})"
                            
                            img_url = item.get('image') or item.get('picture') or item.get('image_url') or item.get('img') or ''
                            desc = item.get('description') or item.get('info') or ''
                                
                            results.append({
                                "id": f"vesna_{sup.id}_{item.get('sku', '0')}",
                                "source": sup.name,
                                "brand": item.get('brand', 'Unknown'),
                                "article": item.get('article', query.upper()),
                                "name": item.get('name', 'Деталь Vesna'),
                                "buy_price": float(item.get('price', 0) or 0),
                                "quantity": display_qty,
                                "is_local": False,
                                "warehouses": warehouses_list,
                                "sku": item.get('sku', ''),
                                "min_qty": item.get('min_order_quantity', 1),
                                "image_url": img_url,
                                "description": desc
                            })
                    else:
                        results.append({
                            "id": f"vesna_err_{sup.id}", "source": f"{sup.name} (ПОМИЛКА {response.status_code})",
                            "brand": "API ERR", "article": query.upper(), "name": f"Відповідь: {response.text[:150]}",
                            "buy_price": 0.0, "quantity": "❌", "is_local": False,
                            "sku": "", "min_qty": 1, "image_url": "", "description": ""
                        })
                except Exception as e:
                    pass

            # === ІНТЕГРАЦІЯ ОМЕГА АВТОПОСТАВКА ===
            elif sup.api_key and ('omega' in sup.name.lower() or 'омега' in sup.name.lower()):
                try:
                    omega_url = "https://public.omega.page/public/api/v1.0/product/pricelist/paged"
                    
                    # ХАК: Передаємо пошуковий запит у поле "Number" і ще декілька про всяк випадок
                    payload = {
                        "Key": sup.api_key.strip(),
                        "Number": query,
                        "SearchText": query,
                        "From": 0,
                        "Count": 50
                    }
                    
                    response = requests.post(omega_url, json=payload, timeout=10)
                    
                    if response.status_code == 200:
                        raw_data = response.json()
                        items_data = raw_data.get('Result', [])
                        
                        query_clean = query.upper().replace(' ', '').replace('-', '').replace('.', '')
                        omega_added = 0
                        
                        for item in items_data:
                            if not isinstance(item, dict): continue
                            
                            art_clean = str(item.get('Number', '')).upper().replace(' ', '').replace('-', '').replace('.', '')
                            card_clean = str(item.get('Card', '')).upper().replace(' ', '').replace('-', '').replace('.', '')
                            
                            # Фільтр, щоб відсікти сміття, якщо Омега знову проігнорує запит
                            if query_clean not in art_clean and query_clean not in card_clean:
                                continue
                                
                            warehouses_list = []
                            
                            for wh in item.get('Rests', []):
                                wh_name = str(wh.get('Key', 'Склад Омега')).strip()
                                wh_qty = str(wh.get('Value', '0'))
                                
                                pref = prefs_map.get(wh_name) or prefs_map.get(wh_name.lower())
                                is_active = True
                                priority = 99
                                
                                if pref:
                                    is_active = pref.get('is_active', True)
                                    priority = int(pref.get('priority', 99))
                                    
                                if not is_active: continue
                                warehouses_list.append({"name": wh_name, "quantity": wh_qty, "priority": priority})
                                
                            for wh in item.get('SupplierRests', []):
                                wh_name = str(wh.get('WareHouseName', 'Склад Партнера')).strip()
                                wh_qty = str(wh.get('Rest', '0'))
                                
                                pref = prefs_map.get(wh_name) or prefs_map.get(wh_name.lower())
                                is_active = True
                                priority = 99
                                
                                if pref:
                                    is_active = pref.get('is_active', True)
                                    priority = int(pref.get('priority', 99))
                                    
                                if not is_active: continue
                                warehouses_list.append({"name": wh_name, "quantity": wh_qty, "priority": priority})
                                
                            if not warehouses_list: continue
                            
                            def sort_warehouses(w):
                                raw_qty = str(w['quantity']).replace('>', '').replace('<', '').replace('+', '').strip()
                                try: qty = float(raw_qty)
                                except ValueError: qty = 1 if raw_qty else 0
                                has_stock = qty > 0
                                return (0 if has_stock else 1, w['priority'])
                                
                            warehouses_list.sort(key=sort_warehouses)
                            primary_wh = warehouses_list[0]
                            display_qty = f"{primary_wh['quantity']} шт ({primary_wh['name']})"
                            
                            results.append({
                                "id": f"omega_{sup.id}_{item.get('ProductId', '0')}",
                                "source": sup.name,
                                "brand": item.get('BrandDescription', 'Unknown'),
                                "article": item.get('Number', query.upper()),
                                "name": item.get('Description', 'Деталь Omega'),
                                "buy_price": float(item.get('Price', 0) or 0),
                                "quantity": display_qty,
                                "is_local": False,
                                "warehouses": warehouses_list,
                                "sku": str(item.get('ProductId', '')),
                                "min_qty": 1,
                                "image_url": item.get('ImageUrl', ''),
                                "description": item.get('DescriptionUkr', '') or item.get('Info', '')
                            })
                            omega_added += 1

                        if omega_added == 0 and len(items_data) > 0:
                            first = items_data[0]
                            results.append({
                                "id": f"omega_debug_filter_{sup.id}",
                                "source": f"{sup.name} (ДЕБАГ ФІЛЬТРУ)",
                                "brand": "API ІГНОРУЄ ПОШУК",
                                "article": first.get('Number', 'N/A'),
                                "name": f"Перший товар з відповіді: {first.get('Description', '')}",
                                "buy_price": 0.0,
                                "quantity": "Пусто",
                                "is_local": False,
                                "warehouses": [],
                                "sku": "", "min_qty": 1, "image_url": "", "description": "Потрібно спитати в айтішника Омеги, як називається поле для пошуку по артикулу."
                            })

                    else:
                        results.append({
                            "id": f"omega_err_{sup.id}", "source": f"{sup.name} (ПОМИЛКА {response.status_code})",
                            "brand": "API ERR", "article": query.upper(), "name": f"Відповідь: {response.text[:150]}",
                            "buy_price": 0.0, "quantity": "❌", "is_local": False,
                            "sku": "", "min_qty": 1, "image_url": "", "description": ""
                        })
                except Exception as e:
                    pass
                    
            # ТЕСТОВА ЗАГЛУШКА ДЛЯ ІНШИХ API
            elif sup.api_key:
                results.append({
                    "id": f"api_{sup.id}_{query}",
                    "source": sup.name,
                    "brand": "Бренд (API)",
                    "article": query.upper(),
                    "name": f"Тестова деталь {sup.name}",
                    "buy_price": 450.00,
                    "quantity": "В наявності",
                    "is_local": False,
                    "sku": "", "min_qty": 1, "image_url": "", "description": ""
                })
            elif sup.price_file:
                results.append({
                    "id": f"file_{sup.id}_{query}",
                    "source": sup.name,
                    "brand": "Бренд (Прайс)",
                    "article": query.upper(),
                    "name": f"Деталь з прайсу {sup.name}",
                    "buy_price": 380.00,
                    "quantity": "Уточнюйте",
                    "is_local": False,
                    "sku": "", "min_qty": 1, "image_url": "", "description": ""
                })

        return Response(results)
