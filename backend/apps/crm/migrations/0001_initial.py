from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('core', '0002_platformclient_referred_by'),
        ('integrations', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Client',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=255, verbose_name='ПІБ Клієнта')),
                ('phone_number', models.CharField(max_length=20, verbose_name='Телефон')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clients', to='core.company')),
            ],
            options={
                'verbose_name': 'Клієнт',
                'verbose_name_plural': 'Клієнти',
            },
        ),
        migrations.CreateModel(
            name='ServiceCatalog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, verbose_name='Назва послуги (роботи)')),
                ('default_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Стандартна ціна (UAH)')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активна')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='services', to='core.company')),
            ],
        ),
        migrations.CreateModel(
            name='Car',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('plate_number', models.CharField(max_length=20, verbose_name='Держ. номер')),
                ('vin_code', models.CharField(blank=True, max_length=17, null=True, verbose_name='VIN-код')),
                ('make', models.CharField(blank=True, max_length=100, verbose_name='Марка')),
                ('model', models.CharField(blank=True, max_length=100, verbose_name='Модель')),
                ('year', models.IntegerField(blank=True, null=True, verbose_name='Рік випуску')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cars', to='crm.client')),
            ],
        ),
        migrations.CreateModel(
            name='Visit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('DRAFT', 'Підбір / Узгодження'), ('ORDERED', 'Замовлено'), ('COMPLETED', 'Готово (Видано)'), ('CANCELED', 'Скасовано')], default='DRAFT', max_length=20)),
                ('mileage', models.IntegerField(blank=True, null=True, verbose_name='Пробіг (км)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('car', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visits', to='crm.car')),
            ],
        ),
        migrations.CreateModel(
            name='VisitItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('part_number', models.CharField(max_length=100, verbose_name='Артикул')),
                ('brand', models.CharField(max_length=100, verbose_name='Бренд')),
                ('name', models.CharField(max_length=255, verbose_name='Назва деталі')),
                ('purchase_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Ціна закупівлі (UAH)')),
                ('margin_value', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Націнка')),
                ('is_margin_percent', models.BooleanField(default=True, verbose_name='Націнка у відсотках?')),
                ('sell_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Фінальна ціна клієнту')),
                ('logistics_status', models.CharField(choices=[('PENDING', 'Очікує ручного замовлення'), ('ORDERED', 'Замовлено (в процесі)'), ('IN_TRANSIT', 'В дорозі'), ('IN_STOCK', 'На складі (Приїхало)'), ('INSTALLED', 'Встановлено (Видано)')], default='PENDING', max_length=20)),
                ('supplier', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='integrations.supplierconfig', verbose_name='Постачальник')),
                ('visit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='crm.visit')),
            ],
        ),
        migrations.CreateModel(
            name='VisitService',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('custom_name', models.CharField(blank=True, max_length=255, verbose_name='Ручна назва роботи')),
                ('price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Ціна для клієнта (UAH)')),
                ('quantity', models.DecimalField(decimal_places=1, default=1.0, max_digits=5, verbose_name='Кількість / Нормо-години')),
                ('service_catalog', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='crm.servicecatalog', verbose_name='Послуга з довідника')),
                ('visit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='services', to='crm.visit')),
            ],
        ),
    ]
