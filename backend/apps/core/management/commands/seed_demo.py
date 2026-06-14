from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from apps.core.company_options import seed_company_options
from apps.core.models import Category, Company, InventoryItem, OrderPart, OrderService, Supplier, Visit, WorkPost
from apps.core.payment_views import add_payment


class Command(BaseCommand):
    help = 'Create deterministic demo data for local onboarding.'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(username='demo', defaults={'email': 'demo@example.com'})
        if created:
            user.set_password('demo12345')
            user.save(update_fields=['password'])

        company, _ = Company.objects.get_or_create(
            owner=user,
            defaults={'name': 'VIN-matrix Demo STO', 'phone': '+380000000000', 'address': 'Kyiv'},
        )
        seed_company_options(company)
        post, _ = WorkPost.objects.get_or_create(company=company, number=1, defaults={'name': 'Пост 1'})
        supplier, _ = Supplier.objects.get_or_create(company=company, name='Demo Supplier')
        category, _ = Category.objects.get_or_create(company=company, name='Фільтри')
        item, _ = InventoryItem.objects.get_or_create(
            company=company,
            brand='MANN',
            article='W712/95',
            defaults={'category': category, 'supplier': supplier, 'name': 'Масляний фільтр', 'quantity': 12, 'buy_price': 180, 'sell_price': 260},
        )
        visit, _ = Visit.objects.get_or_create(
            company=company,
            plate='AA1234BB',
            defaults={'client': 'Demo Client', 'phone': '+380501112233', 'vin_code': 'WVWZZZ1JZXW000001', 'work_post': post},
        )
        OrderPart.objects.get_or_create(visit=visit, brand=item.brand, article=item.article, defaults={'name': item.name, 'buy_price': item.buy_price, 'sell_price': item.sell_price, 'quantity': 1, 'supplier': supplier.name})
        OrderService.objects.get_or_create(visit=visit, name='Заміна масла', defaults={'price': 500, 'quantity': 1})
        if not visit.prepayment_amount:
            add_payment(visit, user, 300, payment_type='cash', purpose='partial', comment='Demo prepayment')

        self.stdout.write(self.style.SUCCESS('Demo data ready: user demo / demo12345'))
