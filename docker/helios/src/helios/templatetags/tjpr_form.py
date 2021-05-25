#!/usr/bin/python
# -*- coding: utf-8 -*-

__author__ = 'sadj'

from django import template

register = template.Library()


@register.inclusion_tag('tags/tjpr_form.html')
def tjpr_form(form, tipo='default'):
	return {
		'form': form,
		'tipo': tipo
	}
