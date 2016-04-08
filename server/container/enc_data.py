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

#!/usr/bin/python
import sys
sys.path.append('/opt/benome/src/')

import subprocess
import os

from benome.utils import ext

class EncryptedVolume(object):
    def __init__(self, enc_path, dec_path):
        self.enc_path = enc_path
        self.dec_path = dec_path

    def init(self, key):
        success = False

        if os.path.exists(self.enc_path):
            raise Exception('Src path already exists')

        if os.path.exists(self.dec_path):
            raise Exception('Dest path already exists')

        try:
            os.makedirs(self.enc_path)
            os.makedirs(self.dec_path)
        except Exception, e:
            print 'Failed to create directories: %s' % e
        else:
            stdin = subprocess.PIPE
            stdout = subprocess.PIPE
            stderr = subprocess.STDOUT

            process_obj = subprocess.Popen(['encfs', '-S', self.enc_path, self.dec_path],
                            shell=False, stdin=stdin, stdout=stdout, stderr=stderr, close_fds=True)

            params = 'x\n1\n256\n1024\n2\nyes\nyes\nno\nno\n0\nyes\n%s\n' % key
            (result, x) = process_obj.communicate(input=params)

            success = 'Configuration finished' in result

            if not success:
                for path in (self.enc_path, self.dec_path):
                    files = os.listdir(path)

                    for f in files:
                        os.remove(os.path.join(path, f))

                    os.rmdir(path)

        return success

    def open(self, key):
        if self.is_open():
            print 'Already open'
            return True

        stdin = subprocess.PIPE
        stdout = subprocess.PIPE
        stderr = subprocess.STDOUT

        process_obj = subprocess.Popen(['encfs', '-S', self.enc_path, self.dec_path],
                        shell=False, stdin=stdin, stdout=stdout, stderr=stderr, close_fds=True)

        params = '%s\n' % key
        (result, x) = process_obj.communicate(input=params)

        return result == ''

    def close(self):
        result = ext('fusermount', ['-u', self.dec_path], shell=False, raw=True)
        return result == ''

    def is_initialized(self):
        return os.path.exists(self.enc_path) and os.path.exists(self.dec_path) and \
                    os.path.exists(os.path.join(self.enc_path, '.encfs6.xml'))

    def is_open(self, quick=False):
        # Verify that dec_path is mounted off of enc_path
        mounts = ext('/bin/mount', shell=False)
        mounted = any(filter(lambda x: 'encfs on %s type fuse.encfs' % self.dec_path in x, mounts))

        if mounted and quick:
            return True

        if not mounted:
            print 1, 'Not mounted'
            return False

        if not os.path.exists('%s/.encfs6.xml' % self.enc_path):
            print 2, 'Enc XML not found'
            return False

        if not os.path.exists('%s/.encfs6.xml' % self.dec_path):
          print 3, 'Dec XML not found'
          return False

        with open('%s/.encfs6.xml' % self.dec_path, 'rb') as f:
          if 'EncFS' in f.read():
              print 4, 'Dec XML not encrypted'
              return False

        from uuid import uuid4
        u = str(uuid4())
        test_file = os.path.join(self.dec_path, u)

        ext('touch %s' % test_file)

        try:
            if not os.path.exists(os.path.join(self.enc_path, u)):
                print 5, 'File written to dec not found in enc'
                return False
        finally:
            os.remove(test_file)

        return True

if __name__ == '__main__':
    key = 'test'
    ev = EncryptedVolume('/tmp/enc', '/tmp/dec')
    #print ev.init(key)
    #print ev.is_open()
    #print ev.open(key)
    print ev.close()
