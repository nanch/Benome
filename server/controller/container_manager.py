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

import time
import simplejson
from uuid import uuid4

from global_config import REDIS_HOST, CONTAINER_PORT, CONTAINER_BASE_IMAGE
from benome.utils import connect_redis, disconnect_redis, json_get

class ContainerManager(object):
    def __init__(self, controller_url, dns_host, user_manager=None):
        self.controller_url = controller_url
        self.dns_host = dns_host

        self.redis = connect_redis(host=REDIS_HOST)

        if user_manager is None:
            from user_manager import UserManager
            self.user_manager = UserManager()
        elif user_manager:
            self.user_manager = user_manager

    def ensure_container(self, user_id, container_name=None, user_is_valid=False):
        if not user_is_valid:
            # Raise exception if user id is not valid
            user_details = self.user_manager.get_user(user_id)

        # Init the container if need be, get container_id otherwise
        if not container_name:
            container_name = user_id

        return self.init_container(user_id, container_name)

    def init_container(self, user_id, container_name=None):
        'Init the container and map to the user'

        container_id = self.get_user_container_id(user_id)
        if container_id:
            try:
                self.start_container(container_id, user_id)
            except Exception, e:
                print 'Failed to start existing container %s: %s' % (container_id, e)
            else:
                return container_id

        import os
        src_code_dir = '/opt/benome/src'
        dest_code_dir = '/opt/benome/src'
        data_dir = '/opt/benome/data/%s' % user_id

        if not os.path.exists(data_dir):
            os.makedirs(data_dir)

        if not os.path.isdir(data_dir):
            raise Exception('Data dir not available')

        cmd = ['/usr/bin/python', os.path.join(dest_code_dir, 'container/container.py')]
        #auth_token = str(uuid4())

        container_id = self.docker([
                'run', '-d', '-p', str(CONTAINER_PORT), '--dns=%s' % self.dns_host,
                '--name="%s"' % container_name,
                '-v', '%s:%s' % (data_dir, data_dir),
                '-v', '%s:%s' % (src_code_dir, dest_code_dir),
                '-e', 'BENOME_DATA_DIR=%s' % data_dir,
                '-e', 'BENOME_USERID=%s' % user_id,
                '-e', 'BENOME_CONTAINER_PORT=%s' % CONTAINER_PORT,
                #'-e', 'BENOME_CONTROLLER_URL=%s' % self.controller_url,
                #'-e', 'BENOME_CONTROLLER_AUTHTOKEN=%s' % auth_token,
                '-e', 'PYTHONPATH=/opt/benome/src',
                CONTAINER_BASE_IMAGE
            ] + cmd)

        # Verify that it loaded successfully
        container_running = False
        container_ext_port = None
        begin_time = time.time()

        while not container_running and time.time() - begin_time < 5:
            container_state = self.get_container_state(container_id)

            if container_state:
                container_exists = True
                container_running = container_state['State']['Running']

                if container_running:
                    container_ext_port = self.get_container_ext_port(container_state)
                    break

            time.sleep(0.25)

        if container_running:
            self.set_user_port(user_id, container_ext_port)
            self.set_user_container_id(user_id, container_id)
            #self.set_user_auth_token(user_id, auth_token)
        else:
            raise Exception('Container failed to initialize')

        return container_id

    def get_container_ext_port(self, container_state):
        return container_state['NetworkSettings']['Ports']['%s/tcp' % str(CONTAINER_PORT)][0]['HostPort']

    def get_user_container_id(self, user_id):
        return self.redis.hget('UserContainerMap', user_id)

    def set_user_container_id(self, user_id, container_id):
        self.redis.hset('UserContainerMap', user_id, container_id)

    def delete_user_container_id(self, user_id):
        self.redis.hdel('UserContainerMap', user_id)

    # def set_user_auth_token(self, user_id, auth_token):
    #     self.redis.hset('UserContainerTokenMap', user_id, auth_token)

    def set_user_port(self, user_id, port):
        self.redis.hset('UserPortMap', user_id, port)

    def get_user_port(self, user_id):
        return self.redis.hget('UserPortMap', user_id)

    def clear_user_state(self, user_id):
        self.delete_user_container_id(user_id)
        self.redis.hdel('UserContainerTokenMap', user_id)
        self.redis.hdel('UserPortMap', user_id)

    def start_container(self, container_id, user_id):
        container_state = self.get_container_state(container_id)
        if not container_state:
            raise Exception('Invalid container state')
        elif container_state['State']['Running']:
            return
        else:
            self.docker(['start', container_id])

            container_state = self.get_container_state(container_id)
            if not container_state or not container_state['State']['Running']:
                raise Exception('Could not start container: %s' % container_id)
            else:
                self.set_user_port(user_id, self.get_container_ext_port(container_state))
                self.set_user_container_id(user_id, container_id)
                time.sleep(1)

    def get_container_state(self, container_id):
        if not container_id:
            return None

        container_state = None
        result = self.docker(['inspect', container_id])
        if result:
            try:
                container_state = simplejson.loads(result)[0]
            except Exception, e:
                print 'Error parsing Docker response: %s, |%s|' % (e, result)

        return container_state

    def verify_container(self, user_id):
        container_port = self.get_user_port(user_id)
        ready = False

        if container_port:
            ping_url = 'http://127.0.0.1:%s/ping' % container_port

            tries = 0
            while not ready and tries < 10:
                result = json_get(ping_url, timeout=0.5)
                if result and result.get('Success'):
                    ready = True
                    break

                time.sleep(0.4)
                tries += 1

        return ready

    def shutdown_container(self, user_id, kill=False, remove=False):
        container_id = self.get_user_container_id(user_id)
        container_port = self.get_user_port(user_id)

        try:
            if container_port:
                # Graceful shutdown
                sync_url = 'http://127.0.0.1:%s/sync' % container_port
                try:
                    json_get(sync_url)
                    time.sleep(2)
                except:
                    pass

                try:
                    exit_url = 'http://127.0.0.1:%s/exit' % container_port
                    json_get(exit_url)
                except:
                    pass

            if container_id:
                if kill:
                    # Wait until process finishes, then kill it
                    #self.docker(['wait', container_id])
                    self.docker(['kill', container_id])

                if remove:
                    self.docker(['rm', '-f', container_id])
        except Exception, e:
            print 'Error shutting down container: %s' % e

        #self.clear_user_state(user_id)

    def docker(self, args, stdin=None):
        from benome.utils import ext
        #print ' '.join(args)
        return ext('docker', list(args), wait=True, shell=False, raw=True, debug=False).strip()

if __name__ == '__main__':
    pass
