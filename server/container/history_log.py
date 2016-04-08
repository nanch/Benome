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
from functools import wraps
from flask import request

data_history_db = None

class DataHistoryDB(object):
    def __init__(self, db):
        self._db = db
        self.init_db()

    def db(self, new=False):
        return self._db

    def init_db(self):
        db = self.db()
        #db.execute('DROP TABLE RequestHistory')
        db.execute('CREATE TABLE IF NOT EXISTS RequestHistory ( \
                                    RequestID INTEGER PRIMARY KEY AUTOINCREMENT, \
                                    DateAdded DATETIME DEFAULT current_timestamp, \
                                    Method TEXT, \
                                    Url TEXT, \
                                    Args TEXT, \
                                    Form TEXT, \
                                    Json TEXT)')
        db.commit()
        return

    def add(self, method, url, args, form, json):
        db = self.db()
        cursor = db.cursor()

        query = 'INSERT INTO RequestHistory (Method, Url, Args, Form, Json) VALUES (?, ?, ?, ?, ?)'
        result = cursor.execute(query, (
            method,
            url,
            simplejson.dumps(args),
            simplejson.dumps(form),
            simplejson.dumps(json)
        ))
        db.commit()

def init_history_db(db_path='./DataHistory.db'):
    import sqlite3
    db = sqlite3.connect(db_path)

    global data_history_db
    data_history_db = DataHistoryDB(db)
    return data_history_db

def log_change(f):
    @wraps(f)
    def decorated_function( *args, **kwargs):
        global data_history_db
        data_history_db.add(request.method, request.path, dict(request.args), dict(request.form), request.json)
        return f(*args, **kwargs)
    return decorated_function
