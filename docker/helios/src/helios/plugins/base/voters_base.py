#!/usr/bin/python
# -*- coding: utf-8 -*-

__author__ = 'sadj'

import csv
import io
from dataclasses import dataclass
from enum import Enum, Flag, auto
from typing import List

import pluginlib
from django import forms

from helios_auth.models import User


class ProvidedService(Flag):
	NONE = 0
	CATEGORY = auto()
	SINGLE = auto()


# formulário de inclusão individual
class SingleForm(forms.Form):
	form_type = forms.CharField(widget=forms.HiddenInput(), initial="single")


# formulário de inclusão por categoria
class CategoryForm(forms.Form):
	form_type = forms.CharField(widget=forms.HiddenInput(), initial="category")
	subtype = forms.CharField(widget=forms.HiddenInput(), initial="default")


# lista as categorias de eleitor atendidas pelo serviço
class Category(Enum):
	@classmethod
	def get_choices(cls):
		return [(x.name, x.value) for x in cls]


# possui os dados do eleitor para cadastro de usuário e de eleitor
@dataclass
class LoadedVoter:
	name: str
	email: str
	login: str
	type: str
	
	def get_csv_row(self):
		return [self.login, self.email, self.name]
	
	def get_as_user(self) -> User:
		return User(
			user_type=self.type,
			user_id=self.login,
			name=self.name,
			info={'email': self.email},
			token=None,
			admin_p=False
		)


# classe que deve ser implementada pelos serviços que fornecem lista de eleitores
@pluginlib.Parent('voters')
class VotersBase(object):
	
	services = ProvidedService.NONE
	single_form = SingleForm
	category_forms: List[CategoryForm] = []
	
	def __init__(self):
		self._config = None
	
	def set_config(self, config):
		self._config = config
	
	@property
	def has_category(self) -> bool:
		return ProvidedService.CATEGORY in self.services
	
	@property
	def has_single(self) -> bool:
		return ProvidedService.SINGLE in self.services
	
	def get_category_form_by_subtype(self, subtype: str) -> CategoryForm:
		for form in self.category_forms:
			if form()['subtype'].initial == subtype:
				return form
		return None
	
	@pluginlib.abstractmethod
	def load_voter(self, form: SingleForm) -> LoadedVoter:
		pass
	
	@pluginlib.abstractmethod
	def get_voters_by_category(self, form: CategoryForm) -> List[LoadedVoter]:
		pass

	@staticmethod
	def get_voters_csv(voters: List[LoadedVoter]) -> str:
		output = io.StringIO()
		writer = csv.writer(output)
		for voter in voters:
			writer.writerow(voter.get_csv_row())
		return output.getvalue()
