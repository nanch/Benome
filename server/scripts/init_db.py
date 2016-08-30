import sys
sys.path.append('../..')
import sqlite3
import time
import simplejson

class App(object):
    pass

class BehaveApp(App):
    name = 'Behave'

    def __init__(self):
        pass

    def init_struct(self, db, root_id, user_id):
        '''Given the root node, call API methods to add necessary structure and attributes'''

        app_context_id = get_next_id(db)
        label = self.name
        create_context(db, app_context_id, user_id, label, parent_id=root_id)

        bonus_context_id = get_next_id(db)
        label = 'Bonuses'
        create_context(db, bonus_context_id, user_id, label, parent_id=app_context_id)

        #self.add_bonuses(db, bonus_context_id)

        return app_context_id

    def add_bonuses(self, db, bonus_def_root_id):
        pass


class GlobalApp(App):
    name = 'Global'

    def __init__(self):
        pass

    def init_struct(self, db, root_id, user_id):
        '''Given the root node, call API methods to add necessary structure and attributes'''

        app_context_id = get_next_id(db)
        label = self.name
        create_context(db, app_context_id, user_id, label, parent_id=root_id)

        return app_context_id


def create_context(db, context_id, user_id, label, parent_id=None):
    insert_node = 'INSERT INTO Nodes (ID, UserID, Type, Label, TimeStamp) VALUES (?, ?, ?, ?, ?)'
    insert_node_attr = 'INSERT INTO Attributes (NodeID, NameSpaceID, Name, Value, Properties) VALUES (?, ?, ?, ?, ?)'
    insert_assoc = 'INSERT INTO Associations (UserID, SourceID, DestID, Key) VALUES (?, ?, ?, ?)'

    ts = int(time.time())

    db.execute(insert_node, (
        context_id,
        user_id,
        'Context',
        label,
        ts
    ))

    if parent_id:
        db.execute(insert_assoc, (
            user_id,
            parent_id,
            context_id,
            'down'
        ))

        db.execute(insert_assoc, (
            user_id,
            context_id,
            parent_id,
            'up'
        ))

def get_context(db, context_id):
    context_query = '''
        SELECT
            Nodes.ID, Nodes.Label, Nodes.Timestamp
        FROM
            Nodes
        WHERE
            Nodes.ID = ?
            AND
            Nodes.Type = 'Context'
        '''
    context_result = db.execute(context_query, (context_id, )).fetchone()
    if not context_result:
        return None

    context_id, label, ts = context_result

    context_attribute_query = '''
        SELECT
            Attributes.NameSpaceID, Attributes.Name, Attributes.Value
        FROM
            Attributes
        WHERE
            Attributes.NodeID = ?
        '''
    attributes_result = db.execute(context_attribute_query, (context_id, )).fetchall()

    attributes = {}
    if attributes_result:
        for namespace_id, attr_name, attr_value in attributes_result:
            namespace_id = namespace_id or 1
            key = '%d__%s' % (namespace_id, attr_name)
            attributes[key] = attr_value

    assoc_query = '''
        SELECT
            ID, SourceID, DestID, Key
        FROM
            Associations
        WHERE
            SourceID = ?
            OR
            DestID = ?
        '''
    assoc_result = db.execute(assoc_query, (context_id, context_id)).fetchall()

    associations = {
        'In': [],
        'Out': []
    }
    for row in assoc_result:
        assoc_id, source_id, dest_id, key = row
        if source_id == context_id:
            associations['Out'].append({
                'AssocID': assoc_id,
                'OtherID': dest_id,
                'Key': key
            })
        elif dest_id == context_id:
            associations['In'].append({
                'AssocID': assoc_id,
                'OtherID': source_id,
                'Key': key
            })

    return {
        'ID': context_id,
        'Label': label,
        'Timestamp': ts,
        'Attributes': attributes,
        'Associations': associations
    }

def get_next_id(db):
    root_context_id = get_node_id(db, 'Root')
    root_context = get_context(db, root_context_id)

    last_id = int(root_context['Attributes']['1__LastID'])
    next_id = last_id + 1
    set_context_attribute(db, root_context_id, 'LastID', next_id)

    return next_id

def set_context_attribute(db, context_id, attr_name, attr_value, namespace_id=1):
    namespace_id = namespace_id or 1
    set_query = '''REPLACE INTO Attributes (NodeID, NameSpaceID, Name, Value) VALUES (?, ?, ?, ?)'''
    result = db.execute(set_query, (int(context_id), int(namespace_id), str(attr_name), str(attr_value))).fetchone()
    db.commit()

def init_user_struct(db, root_context_id=1000, user_id=1):
    # Get current ID
    create_context(db, root_context_id, user_id, 'Root', parent_id=None)

    ui_context_id = root_context_id + 1
    create_context(db, ui_context_id, user_id, 'UI', root_context_id)

    prefs_context_id = root_context_id + 2
    create_context(db, prefs_context_id, user_id, 'Prefs', root_context_id)

    apps_context_id = root_context_id + 3
    create_context(db, apps_context_id, user_id, 'Apps', root_context_id)

    user_root_context_id = root_context_id + 4
    create_context(db, user_root_context_id, user_id, '', root_context_id)

    state_context_id = root_context_id + 5
    create_context(db, state_context_id, user_id, 'State', root_context_id)

    set_context_attribute(db, root_context_id, 'LastID', root_context_id + 1000)

    db.commit()

def get_node_id(db, name):
    # Quick hack

    if name == 'Root':
        return 1000
    elif name == 'UI':
        return 1001
    elif name == 'Prefs':
        return 1002
    elif name == 'Apps':
        return 1003
    elif name == 'UserRoot':
        return 1004
    elif name == 'State':
        return 1005

app_idx = {
    'Global': GlobalApp,
    'Behave': BehaveApp
}

def add_app(db, app_name, user_id):
    app_cls = app_idx.get(app_name)
    if not app_cls:
        return

    app = app_cls()

    app_root_id = get_node_id(db, 'Apps')
    app_context_id = app.init_struct(db, app_root_id, user_id)
    db.commit()
    return app_context_id

def get_app_id(db, app_name):
    app_root_id = get_node_id(db, 'Apps')
    app_root_context = get_context(db, app_root_id)

    if app_root_context:
        for assoc in app_root_context['Associations']['Out']:
            key = assoc['Key']
            context_id = assoc['OtherID']

            if key != 'down':
                continue

            app_context = get_context(db, context_id)
            if not app_context:
                continue

            if app_context['Label'] == app_name:
                return context_id

def add_app_db(db, app_name, user_id=1):
    app_id = get_app_id(db, app_name)

    if not app_id:
        app_context_id = add_app(db, app_name, user_id)
        if app_context_id:
            print 'App %s initialized with ID=%d' % (app_name, app_context_id)
        else:
            print 'App unknown: %s' % app_name
    else:
        print 'App already initialized: %s' % app_name

    return app_id

def init_db_struct(db, root_context_id=1000, user_id=1, include_apps=None):
    # Initialize the root if it doesn't exist
    root_context = get_context(db, root_context_id)
    if not root_context:
        init_user_struct(db, root_context_id=root_context_id, user_id=user_id)
    else:
        print 'Already initialized'
        #print simplejson.dumps(root_context, indent=4)

    if not include_apps:
        include_apps = ['Global']

    if 'Global' not in include_apps:
        include_apps.append('Global')

    for app_name in include_apps:
        add_app(db, app_name, user_id)
        
    return get_node_id(db, 'UserRoot')

def init_tables(db):
    db.execute('''CREATE TABLE IF NOT EXISTS Nodes (
        ID INTEGER PRIMARY KEY,
        UserID INTEGER,
        Type TEXT,
        Label TEXT,
        TimeStamp FLOAT,

        CHECK (Type IN ("Context", "Point"))
    )''')

    db.execute('''CREATE TABLE IF NOT EXISTS Attributes (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        NodeID INTEGER,
        NameSpaceID INTEGER DEFAULT 1,
        Name TEXT,
        Value TEXT,
        Properties TEXT
    )''')

    db.execute('''CREATE TABLE IF NOT EXISTS Associations (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        UserID INTEGER,
        NameSpaceID INTEGER DEFAULT 1,
        SourceID INTEGER,
        DestID INTEGER,
        Key TEXT
    )''')

    # CREATE UNIQUE INDEX 'Associations_ID_PKey' ON 'Associations' ('ID' ASC)
    db.execute('''CREATE INDEX IF NOT EXISTS 'Associations_SourceID' ON 'Associations' ('SourceID' ASC)''')
    db.execute('''CREATE INDEX IF NOT EXISTS 'Associations_Key' ON 'Associations' ('Key' ASC)''')
    db.execute('''CREATE INDEX IF NOT EXISTS 'Attributes_NodeID' ON 'Attributes' ('NodeID' ASC)''')
    db.execute('''CREATE INDEX IF NOT EXISTS 'Associations_DestID' ON 'Associations' ('DestID' ASC)''')

    # Required for REPLACE INTO to work
    db.execute('''CREATE UNIQUE INDEX IF NOT EXISTS 'Attributes_NodeID_AttrName_NameSpaceID' ON 
                    'Attributes' ('NodeID' ASC, 'Name' ASC, 'NameSpaceID' ASC)''')

    # Required for REPLACE INTO to work
    db.execute('''CREATE UNIQUE INDEX IF NOT EXISTS 'Associations_UserID_SourceID_DestID_Key' ON 
                    'Associations' ('UserID' ASC, 'NamespaceID' ASC, 'SourceID' ASC, 'DestID' ASC, 'Key' ASC)''')

    db.commit()

def import_json_struct(db, import_root_id, json_path, user_id=1, replace_root=False):
    root_context = get_context(db, import_root_id)
    if not root_context:
        raise Exception('Import root not found')

    try:
        with open(json_path, 'r') as f:
            json_struct = f.read()
    except Exception as e:
        print e
        raise Exception('Import source not found')

    try:
        struct = simplejson.loads(json_struct)
    except Exception as e:
        print e
        raise Exception('Import source failed to load')

    def traverse_struct(struct, parent_id, is_root=False):
        label = struct.get('label', '')
        if replace_root and is_root:
            set_context_attribute(db, parent_id, 'Label', label)
            node_id = parent_id
        else:
            node_id = get_next_id(db)
            create_context(db, node_id, user_id, label, parent_id)
            #print 'Created %s=%s from parent %s' % (node_id, label, parent_id)

        target_frequency = struct.get('TargetFrequency')
        if target_frequency:
            set_context_attribute(db, node_id, 'TargetFrequency', target_frequency)

        for child_struct in struct.get('children', []):
            traverse_struct(child_struct, node_id);

    traverse_struct(struct, import_root_id, is_root=True)
    db.commit()

    return True

def init_db(db_path, include_apps=None, import_json=None):
    db = sqlite3.connect(db_path)

    init_tables(db)
    user_root_id = init_db_struct(db, root_context_id=1000, user_id=1, include_apps=include_apps)

    if type(import_json) is tuple and len(import_json) == 3:
        import_root, replace_root, json_path = import_json
        import_root_id = get_node_id(db, import_root)
        if not import_root_id:
            import_root_id = import_root

        import_json_struct(db, import_root_id, json_path, replace_root=replace_root)
        
    db.close()

    return user_root_id

if __name__ == '__main__':
    db_path = sys.argv[1]
    include_apps = []
    try:
        include_apps = sys.argv[2].split(',')
    except:
        pass

    init_db(db_path, include_apps)
