from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.models import (
    Category,
    Company,
    Employee,
    InventoryItem,
    OrderPart,
    OrderService,
    ServiceCatalog,
    Supplier,
    Visit,
    WorkPost,
)


class Command(BaseCommand):
    help = 'Create or refresh a realistic VIN-matrix demo workspace with safe training data.'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='demo_vin', help='Demo account username.')
        parser.add_argument('--password', required=True, help='Password for the demo account.')
        parser.add_argument('--reset', action='store_true', help='Remove existing demo visits, parts and services before seeding.')

    def handle(self, *args, **options):
        username = options['username'].strip()
        password = options['password']
        if not username:
            raise CommandError('Username cannot be empty.')
        if len(password) < 8:
            raise CommandError('Use a demo password of at least 8 characters.')

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'first_name': 'Демо VIN-matrix',
                'email': 'demo@vin-matrix.local',
                'is_staff': True,
                'is_active': True,
            },
        )
        user.first_name = 'Демо VIN-matrix'
        user.email = 'demo@vin-matrix.local'
        user.is_staff = True
        user.is_active = True
        user.set_password(password)
        user.save()

        company, _ = Company.objects.get_or_create(
            owner=user,
            defaults={
                'name': 'Apex Garage — демо',
                'phone': '+38 (050) 555-12-34',
                'address': 'Київ, вул. Механіків, 12',
                'business_type': 'sto',
                'global_margin_percent': Decimal('28.00'),
            },
        )
        company.name = 'Apex Garage — демо'
        company.phone = '+38 (050) 555-12-34'
        company.address = 'Київ, вул. Механіків, 12'
        company.business_type = 'sto'
        company.global_margin_percent = Decimal('28.00')
        company.save()

        Employee.objects.get_or_create(
            user=user,
            defaults={
                'company': company,
                'role': 'partner',
                'can_create_visits': True,
                'can_view_finances': True,
                'partner_code': 'PDEMO12',
            },
        )

        posts = []
        for number, name in [(1, 'Пост 01 — діагностика'), (2, 'Пост 02 — ходова'), (3, 'Пост 03 — ТО')]:
            post, _ = WorkPost.objects.get_or_create(company=company, number=number, defaults={'name': name, 'sort_order': number * 10})
            post.name = name
            post.sort_order = number * 10
            post.is_active = True
            post.save()
            posts.append(post)

        services = [
            ('Комп’ютерна діагностика', Decimal('700.00')),
            ('Заміна масла та фільтрів', Decimal('850.00')),
            ('Діагностика ходової', Decimal('650.00')),
            ('Заміна передніх гальмівних колодок', Decimal('1100.00')),
        ]
        for name, price in services:
            ServiceCatalog.objects.update_or_create(company=company, name=name, defaults={'price': price})

        category, _ = Category.objects.get_or_create(company=company, name='Регламентне ТО')
        supplier, _ = Supplier.objects.get_or_create(company=company, name='Демо-постачальник', defaults={'api_type': 'custom'})
        stock = [
            ('MANN', 'W 712/95', 'Фільтр масляний', 7, Decimal('220.00'), Decimal('320.00')),
            ('BOSCH', '0 986 494 526', 'Колодки гальмівні передні', 5, Decimal('1120.00'), Decimal('1580.00')),
            ('NGK', '9723', 'Свічка запалювання', 16, Decimal('180.00'), Decimal('260.00')),
            ('MOBIL', '152053', 'Моторна олива 5W-30, 4 л', 9, Decimal('1320.00'), Decimal('1790.00')),
        ]
        for brand, article, name, quantity, buy_price, sell_price in stock:
            InventoryItem.objects.update_or_create(
                company=company,
                brand=brand,
                article=article,
                defaults={
                    'category': category,
                    'supplier': supplier,
                    'name': name,
                    'quantity': quantity,
                    'buy_price': buy_price,
                    'sell_price': sell_price,
                },
            )

        if options['reset']:
            Visit.objects.filter(company=company).delete()

        now = timezone.now()
        visits = [
            {
                'plate': 'AA 2481 KT', 'vin_code': 'TMBJG7NE8H0123456', 'client': 'Андрій Коваль', 'phone': '+380501112233',
                'status': 'DIAGNOSTIC', 'payment_status': 'partial', 'prepayment_amount': Decimal('1500.00'),
                'comment': 'Перевірити підвіску та сторонній шум при гальмуванні.', 'work_post': posts[0], 'scheduled_datetime': now + timedelta(hours=1),
                'services': [('Діагностика ходової', Decimal('650.00'))],
                'parts': [('BOSCH', '0 986 494 526', 'Колодки гальмівні передні', Decimal('1120.00'), Decimal('1580.00'))],
            },
            {
                'plate': 'KA 7304 HC', 'vin_code': 'JTMDFREV60D123456', 'client': 'Ірина Марченко', 'phone': '+380671234567',
                'status': 'PARTS_RESERVED', 'payment_status': 'unpaid', 'prepayment_amount': Decimal('0.00'),
                'comment': 'Планове ТО. Запчастини зарезервовано.', 'work_post': posts[2], 'scheduled_datetime': now + timedelta(hours=3),
                'services': [('Заміна масла та фільтрів', Decimal('850.00'))],
                'parts': [('MANN', 'W 712/95', 'Фільтр масляний', Decimal('220.00'), Decimal('320.00')), ('MOBIL', '152053', 'Моторна олива 5W-30, 4 л', Decimal('1320.00'), Decimal('1790.00'))],
            },
            {
                'plate': 'AI 9108 MM', 'vin_code': 'WBAKS410900123456', 'client': 'Сергій Дяченко', 'phone': '+380931234567',
                'status': 'READY', 'payment_status': 'paid', 'prepayment_amount': Decimal('4200.00'),
                'comment': 'Готово до видачі. Надіслати акт і нагадування про оплату.', 'work_post': posts[1], 'scheduled_datetime': now - timedelta(hours=2),
                'services': [('Комп’ютерна діагностика', Decimal('700.00')), ('Заміна передніх гальмівних колодок', Decimal('1100.00'))],
                'parts': [('NGK', '9723', 'Свічка запалювання', Decimal('180.00'), Decimal('260.00'))],
            },
        ]

        for item in visits:
            defaults = {key: value for key, value in item.items() if key not in {'services', 'parts'}}
            visit, _ = Visit.objects.update_or_create(company=company, plate=item['plate'], defaults=defaults)
            OrderService.objects.filter(visit=visit).delete()
            OrderPart.objects.filter(visit=visit).delete()
            for service_name, price in item['services']:
                OrderService.objects.create(visit=visit, mechanic=user, name=service_name, price=price, quantity=1, status='PENDING')
            for brand, article, name, buy_price, sell_price in item['parts']:
                OrderPart.objects.create(visit=visit, brand=brand, article=article, name=name, buy_price=buy_price, sell_price=sell_price, quantity=1, supplier=supplier.name, status='WAITING')

        status = 'created' if created else 'refreshed'
        self.stdout.write(self.style.SUCCESS(f'Demo workspace {status}: {username}'))
        self.stdout.write('Use the supplied password to sign in. Re-run with --reset to restore the original demo data.')
