# Copyright 2016 Steve Hazel
#
# This file is part of Benome.
#
# Benome is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License version 3
# as published by the Free Software Foundation.
#
# Benome is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Benome. If not, see http://www.gnu.org/licenses/.
#

import os
import simplejson
import re
import string
import time
from datetime import datetime
import random
from uuid import uuid4

import requests
from redis import StrictRedis
from flask import Flask, Response, request, make_response, render_template, \
                    redirect, session, abort
from flask.ext.login import LoginManager, UserMixin, login_required, login_user, logout_user, \
                    current_user

from benome.utils import json_response, json_get
from global_config import REDIS_HOST, CONTAINER_PORT, DEFAULT_TZ_OFFSET, GLOBAL_USER_ID, USER_DB_PATH
from container_manager import ContainerManager
from user_manager import UserManager

container_manager = ContainerManager('http://127.0.0.1:5200', '127.0.0.1', user_manager=False)
user_manager = UserManager()

redis = StrictRedis(host=REDIS_HOST, db=0)

app = Flask(__name__)

SECRET_FILE = os.path.normpath(os.path.join('.', 'SECRET.key'))
try:
    secret_key = open(SECRET_FILE).read().strip()
except IOError:
    try:
        secret_key = ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(50))
        with open(SECRET_FILE, 'w') as f:
            f.write(secret_key)
    except IOError:
        raise Exception('Could not open %s for writing!' % SECRET_FILE)


app.config.update(
    SECRET_KEY = secret_key
)
app.secret_key = secret_key

default_features = {
    'PointDetail': True,
    'LeafFocusToggleTimer': True,
    'LeafFocusAutoAdd': True,
    'Admin': True,
    'DetailLevels': True,
    'MovableFocus': True
}

class BenomeControllerException(Exception):
    pass

class BenomeAuthException(BenomeControllerException):
    pass

def api_exception_handler(error):
    from flask import g

    http_code = 200

    if type(error) is BenomeAuthException:
        error_type = 'Authentication Error'
        http_code = 403
    elif type(error) is BenomeControllerException:
        error_type = 'Controller Error'
    else:
        error_type = 'Internal Error'

    import traceback
    traceback.print_exc()

    error_result = {
        'Error': True,
        'Type': error_type,
        'Message': str(error)
    }

    if hasattr(g, 'jsonp') and g.jsonp:
        return '%s(%s)' % (g.jsonp, simplejson.dumps(error_result))
    else:
        return json_response(error_result), http_code

def setup_api_exception(flask_app):
    flask_app.error_handler_spec[None][None] = [((BenomeAuthException, BenomeControllerException, Exception), api_exception_handler)]

setup_api_exception(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

try:
    user_manager.get_user(username=GLOBAL_USER_ID)
except:
    user_manager.add_user(GLOBAL_USER_ID)

class User(UserMixin):
    def __init__(self, user_id, name, config=None, features=None):
        self.id = user_id
        self.name = name
        self.root_context_id = None
        self.config = config or {}
        self.features = features or {}

    def get_name(self):
        return self.name

    def get_id(self):
        return self.id

    def get_root_context_id(self):
        if not self.root_context_id:
            self.root_context_id = call_container('get_root_context_id')

        return self.root_context_id

    def get_last_id(self):
        self.last_id = call_container('get_last_id')
        return self.last_id

    def get_config(self):
        return self.config

    def get_features(self, default_features=None):
        if type(default_features) is not dict:
            default_features = {}

        features = default_features.copy()
        features.update(self.features)

        return features

    def containerized(self):
        return True

    def get_port(self):
        config = self.get_config()

        if config.get('ContainerType') == 'Local':
            return int(config.get('LocalPort'))
        else:
            if self.containerized():
                user_id = self.get_id()
            else:
                user_id = get_global_user_id()

            container_manager.ensure_container(user_id, container_name=self.name, user_is_valid=True)
            container_manager.verify_container(user_id)

            try:
                return int(container_manager.get_user_port(user_id))
            except:
                pass

    def __repr__(self):
        return '<%s: %s>' % (self.id, self.get_name())

def get_global_user_id():
    user_data = user_manager.get_user(username=GLOBAL_USER_ID)
    return user_data['UserID']

def get_global_port():
    return 25001

    # user_id = get_global_user_id()
    # container_manager.ensure_container(user_id)

    # try:
    #     return int(container_manager.get_user_port(user_id))
    # except:
    #     pass

class AnonymousUser(UserMixin):
    def __init__(self):
        self.id = 'Anonymous'
        self.name = self.id

    def get_name(self):
        return self.name

    def get_id(self):
        return self.id

    def get_port(self):
        return get_global_port()

    def is_authenticated(self):
        return False

login_manager.anonymous_user = AnonymousUser

def init_user(username=None, user_id=None, password=None):
    user = None

    try:
        user_details = user_manager.get_user(user_id=user_id, username=username)
    except Exception, e:
        print 'Init user error for %s: %s' % (username, e)
    else:
        user_id = user_details['UserID']
        config = user_details['Config']
        features = user_details['Features']

        if not username:
            username = user_details['Username']
            user = User(str(user_id), str(username), config, features)

        elif user_manager.auth_user(user_id, password):
            username = user_details['Username']
            user = User(str(user_id), str(username), config, features)
        else:
            print 'Auth failed for user'

    return user

@app.errorhandler(401)
def login_failed(e):
    return Response('<p>Login failed</p>')

@login_manager.user_loader
def load_user(user_id):
    return init_user(user_id=user_id)

@app.route('/test', methods=['GET'])
def client_test():
    if not current_user or not current_user.is_authenticated():
        return 'Unauthorized', 403

    return json_response(auth_result(current_user)), 200

@app.route('/data/load/<context_id>', methods=['GET'])
@app.route('/data/load/', methods=['GET'])
#@login_required
def data_load(context_id=None):
    if not current_user or not current_user.is_authenticated():
        return json_response({
            'ContextID': None,
            'Points': [],
            'Contexts': [],
            'Associations': []
        })

    if not context_id or str(context_id) in ('null', 'None'):
        context_id = current_user.get_root_context_id()

    contexts = call_container('get_contexts', data=context_id)
    points = call_container('get_points', data=context_id)
    associations = call_container('get_associations', data=context_id)

    return json_response({
        'ContextID': context_id,
        'LastID': current_user.get_last_id(),
        'Points': points,
        'Contexts': contexts,
        'Associations': associations
    })

@app.route('/get_id_block', methods=['GET'])
@app.route('/get_id_block/<block_size>', methods=['GET'])
@app.route('/data/associations/<context_id>', methods=['GET'])
@app.route('/data/points/<context_id>', methods=['GET'])
@app.route('/data/contexts/<context_id>', methods=['GET'])
@app.route('/data/association/<association_id>', methods=['POST', 'PUT', 'DELETE'])
@app.route('/data/point/<point_id>', methods=['POST', 'PUT', 'DELETE'])
@app.route('/data/context/<context_id>', methods=['POST', 'PUT', 'DELETE'])
def data_interface(*args, **kwargs):
    return forward_container()

@app.route('/cache.manifest', methods=['GET'])
def input_manifest():
    context = {}
    response = make_response(render_template('benome.mf', **context))
    response.headers['Content-Type'] = 'text/cache-manifest'
    response.headers['Cache-Control'] = 'no-cache, private'
    return response

@app.route('/local/', methods=['GET'])
@app.route('/local/<instance_id>', methods=['GET'])
def local_root(instance_id=None):
    return render_template('local.html', **{
        'InstanceID': instance_id
    })

@app.route('/demo/', methods=['GET'])
@app.route('/demo/<instance_id>', methods=['GET'])
def demo_root(instance_id=None):
    return render_template('demo.html', **{
        'InstanceID': instance_id
    })

@app.route('/daily/', methods=['GET'])
def app_daily():
    context = {}
    return render_template('index-daily.html', **context)

@app.route('/cluster/', methods=['GET'])
def app_cluster():
    context = {}
    return render_template('index-cluster.html', **context)

@app.route('/numeric/', methods=['GET'])
def app_numeric():
    context = {}
    return render_template('index-numeric.html', **context)

@app.route('/user/logout', methods=['POST', 'GET'])
def user_logout():
    if current_user and current_user.is_authenticated():
        logout_user()
    else:
        raise BenomeControllerException('Not logged in')

    response = {
        'Success': True
    }

    return json_response(response)

def auth_result(user):
    global default_features

    graph_data = None

    if False and user.is_authenticated():
        query_result = call_container('data_query')
        graph_data = query_result['GraphData']

    return {
        'SessionID': None,
        'ContextID': user.get_root_context_id(),
        'LastID': user.get_last_id(),
        'UserID': user.get_id(),
        'Features': user.get_features(default_features),
        'GraphData': graph_data
    }

@app.route('/user/login', methods=['POST'])
def user_login():
    username = request.form.get('Username')
    password = request.form.get('Password')

    if not username:
        raise BenomeControllerException('Username required')

    user_details = user_manager.get_user(username=username, exception=False)
    if not user_details:
        raise BenomeControllerException('Login failed')

    user_id = None
    context_id = None

    if current_user and current_user.is_authenticated() and current_user.get_name() == username:
        user_id = current_user.get_id()
        context_id = current_user.get_root_context_id()
        user = current_user
    else:
        user = init_user(username=username, password=password)
        if user:
            login_user(user, remember=True)
            user_id = user.get_id()
            context_id = user.get_root_context_id()
        else:
            raise BenomeControllerException('Login failed')

    return json_response(auth_result(user))

@app.route('/user/change_password', methods=['POST'])
def user_change_password():
    if current_user and not current_user.is_authenticated():
        raise BenomeControllerException('Must be already authenticated')

    old_password = request.form.get('OldPassword')
    new_password = request.form.get('NewPassword')

    if not old_password or old_password == new_password:
        raise BenomeControllerException('Invalid input')

    success = user_manager.change_password(current_user.get_id(), old_password, new_password)

    response = {
        'Success': success
    }
    return json_response(response)

@app.route('/<username>', methods=['GET'])
def user_root(username):
    display_username = ''

    if current_user and current_user.is_authenticated():
        current_username = current_user.get_name()
        if current_username != username:
            return redirect('/' + current_username)

        else:
            display_username = '%s\'s' % current_username.title()
    else:
        auth_token = request.args.get('autologin')

        token_map = {
            'fzEp98ABbvrM': ('ycf', 'rwu2Dfg37rsY'),
            '2MLxLxmwjVUw': ('ycf2', 'ZH4ysaFQHfbs'),
            'UNp9Z9EmwMHp': ('ycf3', 'L9FnxeL3vC6u')
        }

        if auth_token in token_map:
            username, password = token_map[auth_token]

            user = init_user(username=username, password=password)
            if user:
                login_user(user, remember=True)

    return render_template('base.html', **{
        'Username': display_username
        })

def get_container_host():
    ip = '127.0.0.1'

    from flask.ext.login import current_user
    if not current_user.is_authenticated():
        raise BenomeAuthException('Authentication required')

    port = current_user.get_port()
    if not port or type(port) is not int:
        raise BenomeControllerException('Container not available')

    return 'http://%s:%d' % (ip, port)

def forward_container(url_path=None, as_response=True, return_code=True, timeout=5):
    import requests

    base_host = get_container_host()
    url_path = url_path or request.full_path
    
    headers = {
        'Content-type': 'application/json',
        'Accept': 'application/json'
    }

    try:
        json_data = simplejson.dumps(request.json or {})
        if request.method == 'POST':
            r = requests.post(base_host + url_path, data=json_data, headers=headers, timeout=timeout)
        elif request.method == 'PUT':
            r = requests.put(base_host + url_path, data=json_data, headers=headers, timeout=timeout)
        elif request.method == 'DELETE':
            r = requests.delete(base_host + url_path, data=json_data, headers=headers, timeout=timeout)
        elif request.method == 'GET':
            r = requests.get(base_host + url_path, headers=headers, timeout=timeout)

        if callable(r.json):
            json = r.json()
        else:
            json = r.json

        status_code = r.status_code

    except Exception, e:
        print 'Forward error to %s: %s' % (url_path, e)
        json = None
        status_code = 600

    if return_code:
        return json_response(json), status_code
    else:
        return json_response(json)

def call_container(cmd, data=None, port=None, timeout=5, **kwargs):
    base_host = get_container_host()

    # from flask.ext.login import current_user
    # if not current_user.is_authenticated():
    #     raise Exception('Authentication required')

    # if not port:
    #     port = current_user.get_port()
    #     if not port or type(port) is not int:
    #         raise Exception('Container not available')

    result = None

    if cmd == 'get_root_context_id':
        result, status_code = json_get('%s/get_root_context_id' % base_host, return_code=True, timeout=timeout)

    elif cmd == 'init_root_context_id':
        result, status_code = json_get('%s/init_root_context_id' % base_host, return_code=True, timeout=timeout)

    elif cmd == 'get_id_block':
        result, status_code = json_get('%s/get_id_block' % base_host, return_code=True, timeout=timeout)

    elif cmd == 'get_last_id':
        result, status_code = json_get('%s/get_last_id' % base_host, return_code=True, timeout=timeout)

    elif cmd == 'get_contexts':
        result, status_code = json_get('%s/data/contexts/%s' % (base_host, data), return_code=True, timeout=timeout)

    elif cmd == 'get_points':
        result, status_code = json_get('%s/data/points/%s' % (base_host, data), return_code=True, timeout=timeout)

    elif cmd == 'get_associations':
        result, status_code = json_get('%s/data/associations/%s' % (base_host, data), return_code=True, timeout=timeout)

    elif cmd == 'data_query':
        timeout = 15
        if data:
            url = '%s/data/query/%s' % (base_host, data)
        else:
            url = '%s/data/query' % base_host

        result, status_code = json_get(url, return_code=True, timeout=timeout)

    if is_error(result):
        raise Exception('Container call error: %s' % result)
    elif status_code != 200:
        raise Exception('HTTP error response')

    return result

def is_error(err):
    return type(err) is dict and err.get('Error')


if __name__ == '__main__':
    import sys
    port = 5300
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except:
            raise Exception('Invalid port')

    try:
        app.run(debug=True, host='127.0.0.1', port=port, threaded=True, use_reloader=False)
    except Exception, e:
        print e
