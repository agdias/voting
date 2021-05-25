#!/bin/sh

if [ "$1" = "dev" ]; then
  sleep 15
  echo "Inicializando em modo DEV"
  python3 manage.py migrate
  celery -A helios worker -l info &
  sleep 2
  python3 manage.py runserver 0.0.0.0:8080
  exit 0
else
  echo "Inicializando em modo PRD"
  # https://stackoverflow.com/questions/28444614/django-manage-py-unknown-command-syncdb
  # syncdb is deprecated, use migrate instead.
  # python3 manage.py syncdb
  
  # Este comando coleta os arquivos estáticos e copia para STATIC_ROOT
  python3 manage.py collectstatic --noinput -c
  sleep 10

  python3 manage.py migrate
  
  celery -A helios worker -l info &
  sleep 2
  
  # O traço no --access-logfile e --error-logfile servem para fazer o log no stdout
  # desta forma ele pode ser coletado pelo kubernetes e enviado ao graylog
  gunicorn -b 0:8000 --workers 4 --access-logfile - --error-logfile - --log-level info wsgi:application
fi;
exit 0
