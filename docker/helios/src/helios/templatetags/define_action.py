#!/usr/bin/python
# -*- coding: utf-8 -*-

__author__ = 'sadj'

from django import template
register = template.Library()


# Source: https://stackoverflow.com/questions/1070398/how-to-set-a-value-of-a-variable-inside-a-template-code
@register.simple_tag
def define(val=None):
	return val
