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

import simplejson
import scrypt
import hashlib
import sqlite3

from uuid import uuid4

class UserManager(object):
    def __init__(self, db_path=None):
        if not db_path:
            db_path = '/opt/benome/BenomeUsers.db'
        self.db_path = db_path

        self._db = None
        self.init_db()

    def db(self, new=False):
        if new:
            return sqlite3.connect(self.db_path)

        if not self._db:
            self._db = sqlite3.connect(self.db_path)

        return self._db

    def init_db(self):
        db = sqlite3.connect(self.db_path)
        db.execute('CREATE TABLE IF NOT EXISTS Users ( \
                                            UserID TEXT PRIMARY KEY, \
                                            Username TEXT, \
                                            RootContextID TEXT, \
                                            Password TEXT, \
                                            Salt TEXT, \
                                            Config TEXT)')

        db.execute('CREATE TABLE IF NOT EXISTS UserFeatures ( \
                                            UserID TEXT, \
                                            FeatureName TEXT, \
                                            FeatureEnabled INTEGER)')

        db.commit()
        db.close()
        return

    def add_user(self, username, user_id=None, root_context_id=None, config=None):
        db = self.db(new=True)

        query = 'SELECT Username FROM Users WHERE Username = ? or UserID = ?'
        result = db.execute(query, (username, user_id)).fetchall()

        if result:
            raise Exception('User already exists: %s' % username)

        if not user_id:
            user_id = str(uuid4())

        if type(config) is not dict:
            config = {}

        encoded_config = simplejson.dumps(config)

        query = 'INSERT OR REPLACE INTO Users (UserID, Username, RootContextID, Config) VALUES (?, ?, ?, ?)'

        db.execute(query, (
            user_id,
            username,
            root_context_id,
            encoded_config
        ))
        db.commit()
        db.close()

        return user_id

    # For internal use only.
    def set_password(self, user_id, password):
        db = self.db(new=True)

        try:
            salt = hashlib.sha224(str(uuid4())).hexdigest()
            hashed_password = self.get_password_hash(password, salt, base64=True)

            query = 'UPDATE Users SET Password = ?, Salt = ? WHERE UserID = ?'
            db.execute(query, (
                hashed_password,
                salt,
                user_id
            ))
            db.commit()
        finally:
            db.close()

        return True

    def get_password_hash(self, password, salt, base64=False):
        hashed_password = scrypt.hash(str(password), str(salt))

        if base64:
            return hashed_password.encode('base64')
        else:
            return hashed_password

    def change_password(self, user_id, old_password, new_password):
        if not self.auth_user(user_id, old_password):
            return False

        return self.set_password(user_id, new_password)

    def auth_user(self, user_id, in_password):
        db = self.db(new=True)

        query = 'SELECT Password, Salt FROM Users WHERE UserID = ?'
        result = db.execute(query, (user_id,)).fetchone()

        try:
            hashed_current_password, salt = result
        except:
            return False
        else:
            if not hashed_current_password:
                print 'No password set for user %s' % user_id
                return False
            else:
                hashed_in_password = self.get_password_hash(in_password, salt, base64=True)
                return hashed_current_password == hashed_in_password
        finally:
            db.close()

    def get_user(self, user_id=None, username=None, exception=True):
        db = self.db(new=True)

        if user_id:
            col = 'UserID'
            param = user_id
        else:
            col = 'UserName'
            param = username

        query = 'SELECT UserID, Username, RootContextID, Config FROM Users WHERE LOWER(%s) = LOWER(?)' % col
        result = db.execute(query, (param,)).fetchall()

        if not result:
            if exception:
                raise Exception('User not found: %s' % username)
            else:
                return False

        user_id, username, root_context_id, encoded_config = result[0]

        db.close()

        return {
            'UserID': user_id,
            'Username': username,
            'RootContextID': root_context_id,
            'Config': simplejson.loads(encoded_config),
            'Features': self.get_user_features(user_id)
        }

    def get_user_features(self, user_id):
        db = self.db(new=True)
        result = db.execute('SELECT FeatureName, FeatureEnabled FROM UserFeatures WHERE UserID = ?', [user_id]).fetchall()
        db.close()

        features = {}
        for feature_name, feature_enabled in result:
            features[feature_name] = True if feature_enabled == 1 else False

        return features

    def get_user_name(self, user_id):
        user_data = self.get_user(user_id=user_id)
        return user_data['Username']

    def delete_user(self, user_id=None, username=None):
        db = self.db(new=True)

        if user_id:
            col = 'UserID'
            param = user_id
        else:
            col = 'UserName'
            param = username

        query = 'DELETE FROM Users WHERE LOWER(%s) = LOWER(?)' % col
        result = db.execute(query, (param,)).fetchall()
        db.commit()
        db.close()

    def get_users(self):
        db = self.db(new=True)

        result = db.execute('SELECT UserID, Username, Config FROM Users').fetchall()

        users = []
        for user_id, username, encoded_config in result:
            user_features = self.get_user_features(user_id)
            users.append({
                'UserID': user_id,
                'Username': username,
                'Config': simplejson.loads(encoded_config),
                'Features': user_features
            })

        db.close()
        return users

    def update_config(self, user_id, config, replace=False):
        if type(config) is not dict:
            raise Exception('Config must be dict')

        user_data = self.get_user(user_id=user_id)
        if not replace:
            prev_config = user_data['Config']
            prev_config.update(config)
            config = prev_config

        db = self.db(new=True)
        query = 'UPDATE Users SET Config = ? WHERE UserID = ?'
        db.execute(query, (simplejson.dumps(config), user_id)).fetchall()
        db.commit()
        db.close()

        return True

    def update_feature(self, user_id, feature_id, feature_enabled=True):
        feature_enabled = 1 if feature_enabled else 0
        
        db = self.db(new=True)
        query = 'SELECT COUNT(*) FROM UserFeatures WHERE UserID = ? AND FeatureName = ?'
        feature_exists = db.execute(query, (
            user_id,
            feature_id
        )).fetchone()[0]

        # Same column order in both queries
        if feature_exists >= 1:
            query = 'UPDATE UserFeatures SET FeatureEnabled = ? WHERE UserID = ? AND FeatureName = ?'
        else:
            query = 'INSERT INTO UserFeatures (FeatureEnabled, UserID, FeatureName) VALUES (?, ?, ?)'

        db.execute(query, (
            feature_enabled,
            user_id,
            feature_id
        ))
        db.commit()
        db.close()

        return True


if __name__ == '__main__':
    #user_id = user_manager.add_user('test-steve3')
    #print user_id

    pass