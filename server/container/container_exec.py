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

import os
import time
import simplejson
from threading import Thread, Timer
from Queue import Queue, Empty

class CommandNotFound(Exception):
    pass

class CommandError(Exception):
    pass

class ContainerExec(Thread):
    def __init__(self, user_id, data_path):
        Thread.__init__(self)
        self.daemon = True

        self.user_id = user_id
        self.data_path = data_path

        self.do_stop = False
        self.queue = Queue()
        self.running = False

        self.cache = {}
        self.exec_bundles = []

    def add_exec_bundle(self, cls):
        self.exec_bundles.append(cls(self))

    def flush(self, save=True):
        while not self.queue.empty():
            time.sleep(0.1)

        return True

    def db_persist_timer(self):
        self.persist_timer = Timer(self.persist_interval, self.db_persist_timer)
        self.persist_timer.daemon = True
        self.persist_timer.start()

    def begin(self):
        if not self.running:
            self.running = True
            self.start()

    def stop_thread(self):
        self.do_stop = True
        self.running = False

    def add(self, cmd, *args, **kwargs):
        result_queue = Queue()
        self.queue.put((cmd, args, kwargs, result_queue))
        return result_queue

    def run(self):
        self.running = True
        while not self.do_stop:
            try:
                cmd, args, kwargs, result_queue = self.queue.get(True, 1)
            except Empty:
                continue
            except Exception:
                continue

            try:
                result = self.handle_item(cmd, args, kwargs)
                result_queue.put((True, result))
            except Exception, e:
                import traceback; traceback.print_exc()
                result_queue.put((False, e))

    def handle_item(self, cmd, args, kwargs):
        try:
            if cmd == 'init':
                return self.init()
            elif cmd == 'inituser':
                return self.init_user()
            elif cmd == 'shutdown':
                return self.shutdown()
            else:
                return self.ext_exec(cmd, args, kwargs)
            
        except Exception, e:
            print 'Error handling command %s [%s, %s]: %s' % (cmd, args, kwargs, e)
            #import traceback; traceback.print_exc()
            raise
        else:
            return cmd

    def ext_exec(self, cmd, args, kwargs):
        for ex in self.exec_bundles:
            try:
                result = ex.exec_cmd(cmd, args, kwargs)
            except Exception, e:
                import traceback; traceback.print_exc()
                raise CommandError(str(e))
            else:
                return result

    def cache_get(self, key, default=None):
        return self.cache.get(key, default)

    def cache_set(self, key, value):
        self.cache[key] = value

    def init(self, data_path=None):
        if not data_path:
            data_path = self.data_path

        # FIXME: direct substitution into path, hardcoded namespace/app ID
        from benome.sql_db import Graph
        db_path = '/opt/benome/data/%s/sql.db' % self.user_id
        g = Graph(root_context_id=1000, db_path=db_path)
        g.load(1, ['1', '2001'])
        self.data = g

        return True

    def init_user(self):
        print 'init_user() disabled'
        return

        # if not self.benome:
        #     print 'init_user failed, not initialized'
        #     return False

        # benome = self.benome
        # user_id = self.user_id
        # user = benome.get_user(user_id)

        # if not user:
        #     benome.init_user(user_id)
        #     init_root_success = self.ext_exec('init-root-context-id', (), {'force': False})

        #     if init_root_success:
        #         benome.g.save()
        #         return True
        #     else:
        #         print 'Failed to init root context ID'

        # return False

    def save(self):
        pass

    def shutdown(self):
        self.stop_thread()
        self.flush(save=True)