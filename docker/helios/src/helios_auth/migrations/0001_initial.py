# Generated by Django 2.2.3 on 2019-09-13 18:36

from django.db import migrations, models
import helios_auth.jsonfield


class Migration(migrations.Migration):
	initial = True

	dependencies = []

	operations = [migrations.CreateModel(name='User', fields=[
		('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
		('user_type', models.CharField(max_length=50)), ('user_id', models.CharField(max_length=100)),
		('name', models.CharField(max_length=200, null=True)), ('info', helios_auth.jsonfield.JSONField()),
		('token', helios_auth.jsonfield.JSONField(null=True)), ('admin_p', models.BooleanField(default=False)), ],
										 options={'unique_together': {('user_type', 'user_id')}, }, ), ]
