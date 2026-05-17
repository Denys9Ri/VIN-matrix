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
            ( ~Q(status__in=['DONE', 'COMPLETED']) & Q(scheduled_datetime__lt=end_of_today) ) | 
            ( ~Q(status__in=['DONE', 'COMPLETED']) & Q(scheduled_datetime__isnull=True) ) | 
            ( Q(status__in=['DONE', 'COMPLETED']) & Q(updated_at__gte=start_of_today) & Q(updated_at__lt=end_of_today) ) 
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


class PartSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_user_company(request.user)
        euro_rate = float(company.euro_rate) if company.euro_rate else 42.00
        
        query = request.query_params.get('q', '').strip()
        is_analog = request.query_params.get('analog') == 'true'
        sup_id = request.query_params.get('supplier_id')
        sku_param = request.query_params.get('sku', '').strip()
        
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

            if sup.api_key and ('vesna' in sup.name.lower() or 'весна' in sup.name.lower()):
                try:
                    parts = sup.api_key.split(':')
                    customer_id = int(parts[0]) if len(parts) > 1 else 0
                    token_raw = parts[1] if len(parts) > 1 else sup.api_key
                    token = token_raw.replace('Token', '').replace('token', '').strip()
                    
                    vesna_url = "https://api.vesna-auto.com.ua/public-api/search-methods/search-by-cross/" if is_analog else "https://api.vesna-auto.com.ua/public-api/search-methods/search-by-article/"
                    
                    headers = {"Authorization": f"Token {token}", "Content-Type": "application/json", "Accept-Language": "uk"}
                    payload = {"customer_id": customer_id, "article": query}
                    response = requests.post(vesna_url, json=payload, headers=headers, timeout=10)
                    
                    if response.status_code == 200:
                        raw_data = response.json()
                        items_data = raw_data.get('data', []) if isinstance(raw_data, dict) else (raw_data if isinstance(raw_data, list) else [])
                        for item in items_data:
                            if not isinstance(item, dict): continue
                            
                            if is_analog and str(item.get('article', '')).upper().replace(' ','').replace('-','') == query.upper().replace(' ','').replace('-',''):
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

            elif sup.api_key and ('omega' in sup.name.lower() or 'омега' in sup.name.lower()):
                try:
                    if is_analog and sku_param and sku_param.isdigit():
                        cross_url = "https://public.omega.page/public/api/v1.0/product/getAllCrosses"
                        payload = {"Key": sup.api_key.strip(), "ProductId": int(sku_param)}
                        response = requests.post(cross_url, json=payload, timeout=10)
                        
                        if response.status_code == 200:
                            crosses = response.json().get('Data', [])
                            seen_codes = set()
                            
                            for cross in crosses[:8]:
                                c_code = str(cross.get('Code', '')).upper()
                                c_brand = str(cross.get('Brand', 'Unknown'))
                                
                                if c_code == query.upper().replace(' ','').replace('-','') or c_code in seen_codes:
                                    continue
                                seen_codes.add(c_code)
                                
                                price_url = "https://public.omega.page/public/api/v1.0/product/search"
                                price_payload = {"Key": sup.api_key.strip(), "SearchPhrase": c_code, "From": 0, "Count": 1}
                                price_res = requests.post(price_url, json=price_payload, timeout=5)
                                
                                has_price = False
                                buy_price = 0
                                warehouses_list = []
                                prod_name = "TecDoc Аналог (Натисніть артикул для повного пошуку)"
                                prod_id = "0"
                                img_url = ""
                                
                                if price_res.status_code == 200:
                                    res_items = price_res.json().get('Result', []) or price_res.json().get('Data', [])
                                    match_item = None
                                    for ri in res_items:
                                        if str(ri.get('BrandDescription', '')).upper() == c_brand.upper() or str(ri.get('Number', '')).upper().replace(' ','').replace('-','') == c_code:
                                          match_item = ri
                                          break
                                    
                                    if not match_item and len(res_items) > 0:
                                        match_item = res_items[0]
                                        
                                    if match_item:
                                        buy_price = float(match_item.get('CustomerPrice') or match_item.get('EffectivePrice') or match_item.get('Price') or 0)
                                        prod_name = match_item.get('Description', prod_name)
                                        prod_id = str(match_item.get('ProductId', '0'))
                                        img_url = match_item.get('ImageUrl', '')
                                        
                                        for wh in match_item.get('Rests', []):
                                            wh_name, wh_qty = str(wh.get('Key', 'Склад Омега')), str(wh.get('Value', '0'))
                                            warehouses_list.append({"name": wh_name, "quantity": wh_qty, "priority": 99, "buy_price": buy_price})
                                        for wh in match_item.get('SupplierRests', []):
                                            wh_name, wh_qty = str(wh.get('WareHouseName', 'Склад Партнера')), str(wh.get('Rest', '0'))
                                            warehouses_list.append({"name": wh_name, "quantity": wh_qty, "priority": 99, "buy_price": buy_price})
                                
                                if warehouses_list:
                                    warehouses_list.sort(key=lambda w: (0 if float(str(w['quantity']).replace('>', '').replace('+', '') or 0) > 0 else 1, w['priority']))
                                    qty_str = f"{warehouses_list[0]['quantity']} шт ({warehouses_list[0]['name']})"
                                    has_price = True
                                else:
                                    qty_str = "Немає в наявності"
                                    warehouses_list = [{"name": "База Омега", "quantity": "0", "priority": 99, "buy_price": 0}]
                                
                                results.append({
                                    "id": f"omega_cross_{sup.id}_{c_code}_{prod_id}", "supplier_id": sup.id, "source": sup.name,
                                    "brand": c_brand, "article": c_code,
                                    "name": prod_name, 
                                    "buy_price": buy_price, 
                                    "quantity": qty_str,
                                    "is_local": False, 
                                    "warehouses": warehouses_list, 
                                    "sku": prod_id, "min_qty": 1, "image_url": img_url, "description": ""
                                })
                    else:
                        omega_url = "https://public.omega.page/public/api/v1.0/product/search"
                        payload = {"Key": sup.api_key.strip(), "SearchPhrase": query, "From": 0, "Count": 50}
                        
                        response = requests.post(omega_url, json=payload, timeout=10)
                        
                        if response.status_code == 200:
                            raw_data = response.json()
                            items_data = raw_data.get('Result', []) or raw_data.get('Data', [])
                            
                            for item in items_data:
                                if not isinstance(item, dict): continue
                                
                                art_val = str(item.get('Number', '')).upper().replace(' ','').replace('-','')
                                card_val = str(item.get('Card', '')).upper().replace(' ','').replace('-','')
                                q_upper = query.upper().replace(' ','').replace('-','')
                                
                                if q_upper not in art_val and q_upper not in card_val:
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
                except Exception as e: print("Omega error", e)

            # === TECHNOMIR ===
            elif sup.api_key and ('tehnomir' in sup.name.lower() or 'техномир' in sup.name.lower()):
                try:
                    tehnomir_url = "https://api.tehnomir.com.ua/price/search"
                    payload = {
                        "apiToken": sup.api_key.strip(),
                        "code": query,
                        "isShowAnalogs": 1 if is_analog else 0, 
                        "currency": "UAH" 
                    }
                    
                    response = requests.post(tehnomir_url, json=payload, timeout=15)
                    
                    if response.status_code == 200:
                        raw_data = response.json()
                        if not raw_data.get('success'):
                            continue
                            
                        items_data = raw_data.get('data', [])
                        
                        for item in items_data:
                            if not isinstance(item, dict): continue
                            
                            brand = str(item.get('brand', 'Unknown'))
                            article = str(item.get('code', query.upper()))
                            
                            q_clean = query.upper().replace(' ', '').replace('-', '').replace('.', '')
                            art_clean = article.upper().replace(' ', '').replace('-', '').replace('.', '')
                            
                            if not is_analog:
                                if q_clean not in art_clean:
                                    continue
                            else:
                                if q_clean == art_clean:
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
                                "id": f"tehno_{sup.id}_{item.get('productId', '0')}_{brand}_{cheapest_wh['name']}", 
                                "supplier_id": sup.id, "source": sup.name,
                                "brand": brand, 
                                "article": article,
                                "name": item.get('descriptionRus') or item.get('descriptionUa') or 'Деталь Technomir', 
                                "buy_price": cheapest_wh['buy_price'], 
                                "quantity": f"{cheapest_wh['quantity']} шт ({cheapest_wh['name']})",
                                "is_local": False, 
                                "warehouses": warehouses_list, 
                                "sku": str(item.get('productId', '')),
                                "min_qty": 1, "image_url": "", "description": ""
                            })
                except Exception: pass
                    
        return Response(results)
