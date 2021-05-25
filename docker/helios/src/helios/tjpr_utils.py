#!/usr/bin/python
# -*- coding: utf-8 -*-

__author__ = 'sadj'

from typing import List

from django.conf import settings
from django.core import mail
from django.urls import reverse

from helios.models import Election, Trustee
from helios.utils import remove_html
from helios.view_utils import render_template_raw
from helios.views import trustee_login


class TJPRUtils:
	@staticmethod
	def send_mail(recipient_list: List[str], subject: str, message: str = None, html: str = None):
		if (message is None) and (html is not None):
			message = remove_html(html)
		mail.send_mail(subject, message, settings.SERVER_EMAIL, recipient_list, html_message=html, fail_silently=True)
	
	@staticmethod
	def send_url(trustee: Trustee):
		params = {
			'host': settings.SECURE_URL_HOST,
			'url': settings.SECURE_URL_HOST + reverse(trustee_login, args=[trustee.election.short_name, trustee.email, trustee.secret]),
			'trustee': trustee
		}
		message = render_template_raw(None, 'email/trustee/send_url.html', params)
		subject = f'ATENÇÃO: Você foi designado como integrante da Comissão Eleitoral para a eleição {trustee.election.name}'
		TJPRUtils.send_mail([f'{trustee.name} <{trustee.email}>'], subject, html=message)
	
	@staticmethod
	def request_decryption_from_trustees(election: Election):
		subject = f'A eleição {election.name} está aguardando a sua parte da descriptografia'
		for trustee in election.trustees_without_tally():
			params = {
				'host': settings.SECURE_URL_HOST,
				'url': settings.SECURE_URL_HOST + reverse(trustee_login, args=[election.short_name, trustee.email, trustee.secret]),
				'election': election
			}
			message = render_template_raw(None, 'email/trustee/request_decryption.html', params)
			TJPRUtils.send_mail([f'{trustee.name} <{trustee.email}>'], subject, html=message)
