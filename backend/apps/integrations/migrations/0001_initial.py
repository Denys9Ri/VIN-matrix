from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('core', '0002_platformclient_referred_by'),
    ]

    operations = [
        migrations.CreateModel(
            name='SupplierConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Назва постачальника (напр. Омега)')),
                ('supplier_type', models.CharField(choices=[('API', 'API Підключення'), ('EXCEL', 'Excel/CSV Прайс')], max_length=10)),
                ('api_token', models.CharField(blank=True, max_length=255, null=True, verbose_name='Ключ API')),
                ('excel_file', models.FileField(blank=True, null=True, upload_to='suppliers_prices/', verbose_name='Файл прайсу')),
                ('column_mapping', models.JSONField(blank=True, help_text='{"articul": "Код", "price": "Ціна"}', null=True)),
                ('currency', models.CharField(choices=[('UAH', 'Гривня'), ('EUR', 'Євро'), ('USD', 'Долар')], default='UAH', max_length=3)),
                ('custom_exchange_rate', models.DecimalField(decimal_places=4, default=1.0, max_digits=10, verbose_name='Ручний курс до UAH')),
                ('is_active', models.BooleanField(default=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='suppliers', to='core.company')),
            ],
        ),
        migrations.CreateModel(
            name='PriceItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('part_number', models.CharField(db_index=True, max_length=100, verbose_name='Артикул (Ключ пошуку)')),
                ('brand', models.CharField(blank=True, max_length=100, null=True, verbose_name='Бренд')),
                ('name', models.CharField(blank=True, max_length=255, null=True, verbose_name='Назва')),
                ('price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Ціна (вже в UAH)')),
                ('quantity', models.CharField(default='В наявності', max_length=50, verbose_name='Залишок')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('supplier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='price_items', to='integrations.supplierconfig')),
            ],
        ),
    ]
