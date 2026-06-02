# Generated manually for stock receipt workflow

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='inventoryitem',
            name='supplier',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_items', to='core.supplier'),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='sell_price',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='inventoryitem',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddIndex(
            model_name='inventoryitem',
            index=models.Index(fields=['company', 'brand', 'article'], name='core_invent_company_4bf5d1_idx'),
        ),
        migrations.CreateModel(
            name='StockMovement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('movement_type', models.CharField(choices=[('receipt', 'Прихід'), ('adjustment', 'Корекція')], default='receipt', max_length=20)),
                ('brand', models.CharField(max_length=100)),
                ('article', models.CharField(max_length=100)),
                ('name', models.TextField()),
                ('quantity', models.IntegerField(default=1)),
                ('buy_price', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('sell_price', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('note', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_movements', to='core.company')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_stock_movements', to=settings.AUTH_USER_MODEL)),
                ('inventory_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movements', to='core.inventoryitem')),
                ('source_order_part', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stock_movements', to='core.orderpart')),
                ('supplier', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stock_movements', to='core.supplier')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='stockmovement',
            index=models.Index(fields=['company', 'created_at'], name='core_stockm_company_f8b9e7_idx'),
        ),
    ]
