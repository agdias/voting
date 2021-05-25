#!/usr/bin/python
# -*- coding: utf-8 -*-

__author__ = 'sadj'

from django.conf.urls import url

from api.views import elections_by_user

urlpatterns = [
	url(r'^elections/(?P<login>[^/]+)$', elections_by_user, name='elections-by-user')
]
