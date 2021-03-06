# -*- coding: utf-8 -*-
from django.urls import include, re_path, path
from django.contrib import admin
from django.conf import settings
from django.views.static import serve

urlpatterns = [
	re_path(r'^auth/', include('helios_auth.urls')),
	re_path(r'^helios/', include('helios.urls')),
	re_path(r'^api/', include('api.urls')),
	path('admin/', admin.site.urls),
	re_path(r'^', include('server_ui.urls')),
	re_path(r'booth/(?P<path>.*)$', serve, {'document_root': settings.ROOT_PATH + '/heliosbooth'}),
	re_path(r'verifier/(?P<path>.*)$', serve, {'document_root': settings.ROOT_PATH + '/heliosverifier'})
]
