#!/usr/bin/python2

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

import sys
import os
import re
import string
import time
import datetime
import simplejson
import atexit
import random
from uuid import uuid4
from Queue import Empty

from flask import Flask, request
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user

from enc_data import EncryptedVolume
from benome.utils import json_response, json_post

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

class BenomeContainerException(Exception):
    pass

class BenomeAuthError(BenomeContainerException):
    pass

class BenomeDataError(BenomeContainerException):
    pass

@app.errorhandler(Exception)
def api_exception_handler(error):
    return_code = 200

    if 'BenomeAuthError' in str(error.__class__):
        error_type = 'Auth Error'
        return_code = 401
    elif 'BenomeDataError' in str(error.__class__):
        error_type = 'Data Error'
        return_code = 403
    elif 'BenomeContainerException' in str(error.__class__):
        error_type = 'Container Error'
    else:
        error_type = 'Internal Error'

    error_result = {
        'Error': True,
        'Type': error_type,
        'Message': str(error)
    }
    return json_response(error_result), return_code

login_manager = LoginManager()
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, user_id):
        self.id = user_id

    def get_id(self):
        return self.id

    def __repr__(self):
        return '<User %s>' % self.get_id()

def init_user(user_id):
    user = User(str(user_id))
    return user

@login_manager.user_loader
def load_user(user_id):
    return init_user(user_id)

# def ensure_data(f):
#     def new_f(*args, **kwargs):
#         validate_auth()

#         return f(*args, **kwargs)
#     return new_f

class Container(object):
    def __init__(self, app, enc_vol, user_id, data_dir, data_path, setup=True):
        self.app = app
        self.enc_vol = enc_vol
        self.user_id = user_id
        self.data_dir = data_dir
        self.data_path = data_path

        self.api_disabled = False

        # Start the task runner thread
        from container_exec import ContainerExec
        self.container_exec = ContainerExec(self.user_id, self.data_path)
        self.container_exec.begin()

        if self.exec_cmd('init'):
            print 'Database loaded'
        else:
            raise Exception('Database not initialized')

        if setup:
            self.setup()

    def setup(self):
        self.app.add_url_rule('/ping', 'ping', self.ping, methods=['GET'])
        self.app.add_url_rule('/sync', 'sync', self.sync, methods=['GET'])
        self.app.add_url_rule('/exit', 'exit', self.exit, methods=['GET'])

        self.app.add_url_rule('/auth', 'auth', self.auth, methods=['GET'])
        self.app.add_url_rule('/unauth', 'unauth', self.unauth, methods=['GET'])

        import atexit
        atexit.register(self.onexit)

        if self.exec_cmd('inituser'):
            print 'User initialized'
        else:
            print 'User exists'

    def onexit(self):
        print 'Flushing command queue'
        self.container_exec.flush(save=True)
        print 'Done'

        if self.enc_vol:
            print self.enc_vol.close()
            print 'Encrypted volume unmounted'

    def add_exec_bundle(self, cls):
        self.container_exec.add_exec_bundle(cls)

    def exec_cmd(self, cmd, params=None, timeout=30, disable=False):
        if self.api_disabled:
            raise Exception('Interface is not available')

        if disable:
            self.api_disabled = True

        if params is None:
            params = []

        q = self.container_exec.add(cmd, *params)
        try:
            success, result = q.get(True, timeout)
        except Empty:
            raise Exception('Result timeout for "%s" after %ds' % (cmd, timeout))
        else:
            if not success:
                raise result

        return result

    @staticmethod
    def is_error(err):
        return type(err) is dict and err.get('Error')

    def validate_auth(self):
        return

        if not current_user or not current_user.is_authenticated():
            raise BenomeAuthError('Unauthorized')

        if self.enc_vol and not self.enc_vol.is_open(quick=True):
            raise BenomeDataError('Unavailable')

    def ping(self):
        if self.api_disabled:
            raise Exception('Interface is not available')

        return json_response({
            'Success': True
        })

    def sync(self):
        self.exec_cmd('shutdown', disable=True)

        return json_response({
            'Success': True
        })

    def exit(self):
        exit(0)

    def auth(self):
        if current_user and current_user.is_authenticated() and self.enc_vol and self.enc_vol.is_open(quick=True):
            raise BenomeAuthError('Already authenticated')

        password = request.args.get('Password', None)

        if not password:
            raise BenomeAuthError('Passphrase required')

        if self.enc_vol:
            if self.enc_vol.is_initialized():
                self.enc_vol.open(password)
            elif not self.enc_vol.is_open():
                init_success = self.enc_vol.init(password)

        if not self.enc_vol or self.enc_vol.is_open():
            if self.exec_cmd('init'):
                print 'Database loaded'

            if self.exec_cmd('inituser'):
                print 'User initialized'

            user = init_user('ContainerUser')
            login_user(user, remember=True)
            return json_response('Success'), 200
        else:
            raise BenomeDataError('Unavailable')

        raise BenomeAuthError('Unauthorized')

    def unauth(self):
        if not current_user or not current_user.is_authenticated():
            raise BenomeAuthError('Unauthorized')

        logout_user()

        if self.enc_vol:
            self.enc_vol.close()

        return json_response('Closed'), 200


def get_config():
    user_id = os.environ.get('BENOME_USERID')
    data_dir = os.environ.get('BENOME_DATA_DIR')

    data_encrypt = os.environ.get('BENOME_DATA_ENCRYPT') == '1'
    multi_user = os.environ.get('BENOME_MULTI_USER') == '1'
    sys_auth_token = os.environ.get('BENOME_SYS_AUTH_TOKEN', 'SYS_AUTH_TOKEN')

    if user_id and data_dir:
        controller_url = os.environ.get('BENOME_CONTROLLER_URL')
        auth_token = os.environ.get('BENOME_CONTROLLER_AUTHTOKEN')

        if controller_url and auth_token:
            print 'Retrieving config from controller %s' % controller_url

            url = os.path.join(controller_url, 'container/config')
            response, status_code = json_post(url, {
                'UserID': user_id,
                'AuthToken': auth_token
                })

            if status_code != 200 or not response or not response.get('Success'):
                raise Exception('Could not get config from controller: %s' % response)

            container_config = response.get('Config')
            port = container_config.get('Port', port)

            user_details = container_config.get('User')
        else:
            port = int(os.environ.get('BENOME_CONTAINER_PORT'))
    else:
        if len(sys.argv) > 1:
            user_id = sys.argv[1]

            port = None
            try:
                port = int(sys.argv[2])
            except:
                from controller.user_manager import UserManager
                user_manager = UserManager()

                user_details = user_manager.get_user(username=user_id)
                config = user_details['Config']

                container_type = config.get('ContainerType')
                if container_type == 'Local':
                    port = int(config.get('LocalPort'))

                if not port:
                    raise Exception('Port not found')

            if len(sys.argv) > 3:
                data_dir = sys.argv[3]
            else:
                data_dir = '/opt/benome/data/%s/' % user_id

            if len(sys.argv) > 4:
                data_encrypt = sys.argv[4] == '1'

            if not os.path.exists(data_dir):
                raise Exception('Data dir does not exist: %s' % data_dir)
        else:
            raise Exception('User ID and port required')

    return user_id, port, data_dir, data_encrypt, multi_user

if __name__ == '__main__':
    host = '0.0.0.0'

    try:
        user_id, port, data_dir, data_encrypt, multi_user = get_config()
    except Exception, e:
        print 'No config available: %s' % e
        exit()

    print 'Listening on %s:%d' % (host, port)

    enc_vol = None
    if data_encrypt:
        print 'Data is encrypted'
        enc_path = os.path.join(data_dir, 'enc')
        dec_path = os.path.join(data_dir, 'dec')

        enc_vol = EncryptedVolume(enc_path, dec_path)
        data_dir = dec_path

    from config import DATA_HISTORY_PATH
    from history_log import init_history_db
    init_history_db(DATA_HISTORY_PATH)

    container = Container(app, enc_vol, user_id, data_dir, os.path.join(data_dir, 'graph.db'), setup=False)

    # Core
    from routes import Routes as DataRoutes
    data_routes = DataRoutes(app, container)

    from data import DataExec
    container.add_exec_bundle(DataExec)

    container.setup()

    try:
        app.run(debug=True, host=host, port=port, threaded=False, use_reloader=False)
    except Exception, e:
        print e
