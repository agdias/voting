## Referência de criação da imagem multi-staged: https://pythonspeed.com/articles/multi-stage-docker-python/

### Imagem do python 3.7 baseada no debian buster com aprox. 1GB
### Utilizada para compilar os requeriments da aplicação
### --user faz com que eles sejam instalados em /root/.local

FROM python:3.7-buster AS compile-image

RUN apt update && apt install -y gettext libpq-dev python-dev libldap2-dev libsasl2-dev python-ldap

COPY src/requirements.txt /app/

RUN cd /app && pip3 install --user -r requirements.txt

### Imagem do python 3.7 baseada no alpine linux com aprox. 175MB
### Apenas o diretório /root/.local é copiado da imagem acima (compile-image)

FROM python:3.7-alpine3.11 AS build-image

ENV PATH=/home/user/.local/bin:$PATH

RUN addgroup -S --gid 500 group && adduser -S -u 500 -h "/home/user" -s /bin/sh user group && chmod 755 "/home/user"

RUN apk --no-cache add openldap-dev postgresql-dev postgresql-client tzdata && mkdir /logs

COPY --from=compile-image --chown=user:group /root/.local /home/user/.local
COPY --chown=user:group src/ /app 
COPY --chown=user:group docker/helios/helios-init.sh /scripts/helios-init.sh

RUN chown -R user:group /scripts && chown -R user:group "/home/user"

WORKDIR /app

USER user

ENTRYPOINT ["/bin/sh","/scripts/helios-init.sh"]
