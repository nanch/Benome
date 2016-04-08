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
import time
import simplejson
import sqlite3
from pdb import set_trace as bp

class Association(object):
    def __init__(self, graph, assoc_id, src_context, dest_context, key):
        self.graph = graph

        self.assoc_id = assoc_id
        self.src = src_context
        self.dest = dest_context
        self.key = key

    def get_id(self):
        return self.assoc_id

    def get_id2(self):
        return self.assoc_id

    def __repr__(self):
        return '<Association %s to %s, key=%s, ID=%s>' % (self.src.get_id(), self.dest.get_id(), self.key, self.assoc_id)


class Context(object):
    def __init__(self, graph, context_id, label, attributes=None, metadata=None):
        self.graph = graph

        self.context_id = context_id
        self.label = label
        self.attributes = attributes or {}
        self.metadata = metadata or {}

        self.outAssoc = {}
        self.inAssoc = {}

    def __repr__(self):
        return '<Context %s>' % (self.get_id(), )

    def set_metadata(self, metadata):
        self.metadata = metadata

    def set(self, namespace_id, attr_name, attr_val):
        assert type(namespace_id) is int

        if namespace_id not in self.attributes:
            self.attributes[namespace_id] = {}

        self.attributes[namespace_id][attr_name] = attr_val
        return True

    def get(self, attr_name, namespace_id=None, default=None):
        if not namespace_id:
            namespace_id = 1
        else:
            assert type(namespace_id) is int

        if self.attributes:
            return self.attributes[namespace_id].get(attr_name, default)

        return default

    def getNS(self, namespace_id, attr_name, default=None):
        return self.get(attr_name, namespace_id=namespace_id, default=default)

    def get_id(self):
        return self.context_id

    def add_assoc(self, assoc):
        assoc_id = assoc.get_id()
        # Add to each context's appropriate direction
        assoc.src.outAssoc[assoc_id] = assoc
        assoc.dest.inAssoc[assoc_id] = assoc

        # Add to graph index
        self.graph.associations[assoc_id] = assoc

    def clone(self, graph=None, as_root=False, deep=False):
        if not graph:
            graph = self.graph
        c = Context(graph, self.context_id, self.label, attributes=self.attributes)

        # Shallow copies
        c.outAssoc = self.outAssoc.copy()
        c.inAssoc = self.inAssoc.copy()

        return c

    def hasOutAssoc(self, key):
        for assoc in self.outAssoc.values():
            if assoc.key == key:
                return True

        return False

    def is_interior(self):
        return self.hasOutAssoc('down')

    def is_leaf(self):
        return not self.is_interior()

    def outV(self, key, ids_only=False):
        result = []
        
        for assoc_id, assoc in self.outAssoc.items():
            if assoc.key != key:
                continue

            if ids_only:
                result.append(assoc.dest.get_id())
            else:
                result.append(assoc.dest)
        return result


class Graph(object):
    def __init__(self, root_context_id=None, contexts=None, associations=None, user_id=None, db_path=None):
        self.root_context_id = root_context_id
        self.contexts = contexts or {}
        self.associations = associations or {}
        self.user_id = user_id or 1
        self.db_path = db_path

        if not db_path:
            raise Exception('No DB path provided')

        if not os.path.exists(db_path):
            raise Exception('DB not found at %s' % db_path)

        self.db = sqlite3.connect(db_path, check_same_thread=False)

    def get_root(self):
        return self.contexts[self.root_context_id]

    def get_id_block(self, block_size=None):
        if not block_size or block_size < 0 or type(block_size) is not int:
            block_size = 1000

        block_begin = self.get_last_id() + 1
        block_end = block_begin + block_size
        self.set_last_id(block_end)

        return block_begin, block_end

    def get_last_id(self):
        root_context = self.get_context(self.root_context_id)
        last_id = root_context.get('LastID')
        last_id = int(last_id)

        if last_id < 3000:
            result = self.db.execute('SELECT MAX(ID) FROM Nodes').fetchone()
            last_id = int(result[0])
            self.set_last_id(last_id)

        return last_id

    def set_last_id(self, last_id):
        root_context = self.get_context(self.root_context_id)
        self.set_context_attr(self.root_context_id, 1, 'LastID', last_id)

    def init_context(self, context_id, label, attributes=None):
        context = Context(self, context_id, label, attributes=attributes)
        self.contexts[context_id] = context
        return context

    def init_assoc(self, assoc_id, src_id, dest_id, key):
        src_context = self.contexts.get(src_id)
        if not src_context:
            print 'Assoc %s init failed, src context not found: %s' % (assoc_id, src_id)
            return
        
        dest_context = self.contexts.get(dest_id)
        if not dest_context:
            print 'Assoc %s init failed, dest context not found: %s' % (assoc_id, dest_id)
            return

        # TODO: Handle case where contexts aren't yet available

        assoc = Association(self, assoc_id, src_context, dest_context, key)

        # Add to contexts
        src_context.outAssoc[assoc_id] = assoc
        dest_context.inAssoc[assoc_id] = assoc

        # Add to graph index
        self.associations[assoc_id] = assoc

        return assoc

    def set_context_attr(self, context_id, namespace_id, attr_name, attr_val, persist=False):
        context = self.get_context(context_id)
        if context:
            if persist:
                db = self.db
                set_query = '''REPLACE INTO Attributes (NodeID, NameSpaceID, Name, Value) VALUES (?, ?, ?, ?)'''
                db.execute(set_query, (int(context_id), namespace_id, str(attr_name), str(attr_value)))
                db.commit()

            return context.set(namespace_id, attr_name, attr_val)
        return False

    def get_context(self, context_id):
        return self.contexts.get(context_id)

    def delete_context(self, context_id, user_id=None):
        user_id = user_id or self.user_id
        db = self.db
        context_id = int(context_id)

        delete_context = 'DELETE FROM Nodes WHERE UserID = ? AND ID = ? AND Type = \'Context\''

        try:
            db.execute(delete_context, (
                    user_id,
                    context_id
                ))
        except Exception, e:
            print 'Context %s delete failed: %s' % (context_id, e)
        else:
            db.commit()

            context = self.get_context(context_id)

            if context:
                for assoc_id, assoc in context.outAssoc.items():
                    del context.outAssoc[assoc_id]
                    del assoc.dest.inAssoc[assoc_id]
                    del self.associations[assoc_id]

                for assoc_id, assoc in context.inAssoc.items():
                    del context.inAssoc[assoc_id]
                    del assoc.src.outAssoc[assoc_id]
                    del self.associations[assoc_id]

                del self.contexts[context_id]

            print 'Context %s deleted' % context_id
            return True

        return False

    def add_context(self, parent_id=None, label='', context_id=None, attributes=None, user_id=None):
        user_id = user_id or self.user_id
        db = self.db
        cursor = db.cursor()

        import sqlite3
        insert_context_attr = 'INSERT INTO Attributes (NodeID, NameSpaceID, Name, Value, Properties) VALUES (?, ?, ?, ?, ?)'
        insert_assoc = 'INSERT INTO Associations (UserID, SourceID, DestID, Key) VALUES (?, ?, ?, ?)'

        assocs = []
        attributes = attributes or {}
        try:
            timestamp = attributes.get(1, {}).get('Timestamp') or time.time()

            if context_id:
                # TODO: Handle ID conflict
                insert_context = 'INSERT INTO Nodes (ID, UserID, Type, Label, TimeStamp) VALUES (?, ?, ?, ?, ?)'
                result = cursor.execute(insert_context, (
                    context_id,
                    user_id,
                    'Context',
                    label,
                    timestamp
                ))
            else:
                insert_context = 'INSERT INTO Nodes (UserID, Type, Label, TimeStamp) VALUES (?, ?, ?, ?)'
                result = cursor.execute(insert_context, (
                    user_id,
                    'Context',
                    label,
                    timestamp
                ))
                context_id = cursor.lastrowid

            if parent_id:
                cursor.execute(insert_assoc, (
                    user_id,
                    context_id,
                    parent_id,
                    'up'
                ))
                assoc_id = cursor.lastrowid
                assocs.append((assoc_id, context_id, parent_id, 'up'))

                cursor.execute(insert_assoc, (
                    user_id,
                    parent_id,
                    context_id,
                    'down'
                ))
                assoc_id = cursor.lastrowid
                assocs.append((assoc_id, parent_id, context_id, 'down'))

            for namespace_id, namespace_attrs in attributes.items():
                for attr_name, attr_val in namespace_attrs.items():
                    if namespace_id == 1 and attr_name == 'Label':
                        continue
                        
                    db.execute(insert_context_attr, (
                        context_id,
                        namespace_id,
                        attr_name,
                        attr_val,
                        ''
                    ))

        except sqlite3.IntegrityError, e:
            print e, context_id, attributes
            context_id = None
        else:
            db.commit()

            self.init_context(context_id, label, attributes)

            for assoc_id, source_id, dest_id, key in assocs:
                self.init_assoc(assoc_id, source_id, dest_id, key)

        return context_id

    def update_context(self, context_id, attributes):
        assert type(context_id) is int

        context = self.get_context(context_id)
        if not context:
            raise Exception('Update failed, context not found: %s' % context_id)

        db = self.db
        import sqlite3

        update_context = 'UPDATE Nodes SET Label = ? WHERE ID = ?'
        update_context_attr = 'REPLACE INTO Attributes (NodeID, NameSpaceID, Name, Value, Properties) VALUES (?, ?, ?, ?, ?)'

        attributes = attributes or {}
        try:
            for namespace_id, namespace_attrs in attributes.items():
                for attr_name, attr_val in namespace_attrs.items():
                    
                    if namespace_id == 1 and attr_name == 'Label':
                        result = db.execute(update_context, (
                            attr_val or '',
                            context_id
                        ))
                        context.label = attr_val

                    else:
                        db.execute(update_context_attr, (
                            context_id,
                            namespace_id,
                            attr_name,
                            attr_val,
                            ''
                        ))
                        context.set(namespace_id, attr_name, attr_val)

        except sqlite3.IntegrityError, e:
            print e, context_id, attributes
        else:
            db.commit()

        return context_id

    def add_assoc(self, source_context_id, key, dest_context_id, namespace_id=None, user_id=None):
        # Add to memory and to DB
        user_id = user_id or self.user_id
        if not namespace_id:
            namespace_id = 1

        # , NamespaceID
        insert_assoc = 'INSERT INTO Associations (UserID, SourceID, DestID, Key) VALUES (?, ?, ?, ?)'

        db = self.db
        cursor = db.cursor()

        assoc_id = None

        try:
            cursor.execute(insert_assoc, (
                user_id,
                source_context_id,
                dest_context_id,
                key,
                #namespace_id
            ))
            assoc_id = cursor.lastrowid
        except sqlite3.IntegrityError, e:
            print 'Error adding Assoc', e, source_context_id, key, dest_context_id
        else:
            db.commit()

            print 'init new assoc with id %s from %s to %s key=%s' % (assoc_id, source_context_id, dest_context_id, key)
            self.init_assoc(assoc_id, source_context_id, dest_context_id, key)

        return assoc_id

    def remove_assoc(self, source_context_id, dest_context_id, key, namespace_id=None, user_id=None):
        # Remove from memory and from DB

        user_id = user_id or self.user_id
        if not namespace_id:
            namespace_id = 1

        select_assoc_id = '''
            SELECT ID FROM Associations WHERE
                UserID = ? AND SourceID = ? and DestID = ? and Key = ?
            '''

        db = self.db
        assoc_id = None

        try:
            result = db.execute(select_assoc_id, (
                user_id,
                source_context_id,
                dest_context_id,
                key,
                #namespace_id
            )).fetchone()
            
            if result:
                assoc_id = result[0]

            if assoc_id:
                db.execute('DELETE FROM Associations WHERE UserID = ? AND ID = ?', (
                    user_id,
                    assoc_id
                ))
        except Exception, e:
            print 'Error removing Assoc', e, source_context_id, key, dest_context_id
        else:
            db.commit()

            if assoc_id:
                assoc = self.associations.get(assoc_id)

                if assoc:
                    # Remove from contexts
                    del assoc.src.outAssoc[assoc_id]
                    del assoc.dest.inAssoc[assoc_id]
                    del self.associations[assoc_id]

    def prune_to_root(self, root_context_id, assoc_key=None):
        new_graph = Graph(db_path=self.db_path, root_context_id=root_context_id)

        root_context = self.contexts[root_context_id].clone(new_graph)
        new_graph.contexts[root_context_id] = root_context

        # Clear out any in/down associations from root context
        for assoc_id, assoc in root_context.inAssoc.items():
            if assoc.key == 'down':
                del root_context.inAssoc[assoc_id]

        # Clear out any out/up associations from root context
        for assoc_id, assoc in root_context.outAssoc.items():
            if assoc.key == 'up':
                del root_context.outAssoc[assoc_id]

        # Continue traversing downward and cloning the contexts
        # Associations are copied
        def traverse(context):
            for assoc in context.outAssoc.values():
                if assoc.key != 'down':
                    continue

                child_context = assoc.dest
                child_context_id = child_context.get_id()

                if child_context_id not in new_graph.contexts:
                    child_context = child_context.clone(new_graph)
                    new_graph.contexts[child_context_id] = child_context
                else:
                    child_context = new_graph.contexts[child_context_id]

                # Keep the same associations as before
                # TODO: Prune associations by key
                new_graph.associations.update(child_context.inAssoc)
                new_graph.associations.update(child_context.outAssoc)

                traverse(child_context)

        traverse(root_context)

        return new_graph

    def get_points(self, anchor_time=None, end_time=None, contexts=None, namespaces=None, user_id=None):
        'Return all points linked to any of the current contexts'
        db = self.db

        user_id = user_id or self.user_id

        context_query = ''
        if contexts:
            contexts = map(str, contexts)
            context_query += '''
                AND
                Associations.DestID IN (%s)
            ''' % ','.join(contexts)

        namespace_query = ''
        if namespaces:
            namespace_query += '''
                AND
                (
                    Attributes.NameSpaceID IS NULL
                    OR
                    Attributes.NameSpaceID IN (%s)
                )
            ''' % (','.join(map(str, namespaces)), )

        range_query = ''
        if end_time or anchor_time:
            if anchor_time:
                range_query += '''
                    AND
                    Nodes.TimeStamp <= %s
                ''' % anchor_time

            if end_time:
                range_query += '''
                    AND
                    Nodes.TimeStamp >= %s
                ''' % end_time

        query = '''
        SELECT
            Nodes.ID, Nodes.TimeStamp, Associations.DestID, Attributes.NameSpaceID,
            Attributes.Name, Attributes.Value
        FROM
            Nodes
                LEFT OUTER JOIN Attributes ON Nodes.ID = Attributes.NodeID
                INNER JOIN Associations ON Nodes.ID = Associations.SourceID
        WHERE
            Nodes.Type = 'Point'
            AND
            Nodes.UserID = ?
            AND
            Associations.Key = 'up'
            %s
            %s
            %s
        ''' % (context_query, namespace_query, range_query)
        result = db.execute(query, (user_id,)).fetchall()
        points = self.generate_points(result)
        return points

    def get_point(self, point_id, user_id=None):
        db = self.db
        user_id = user_id or self.user_id

        query = '''
        SELECT
            Nodes.ID, Nodes.TimeStamp, Associations.DestID, Attributes.NameSpaceID,
            Attributes.Name, Attributes.Value
        FROM
            Nodes
                LEFT OUTER JOIN Attributes ON Nodes.ID = Attributes.NodeID
                INNER JOIN Associations ON Nodes.ID = Associations.SourceID
        WHERE
            Nodes.Type = 'Point'
            AND
            Nodes.ID = ?
            AND
            Associations.Key = 'up'
        '''
        result = db.execute(query, (point_id,)).fetchall()
        if result:
            points = self.generate_points(result)
            if points and len(points) > 0:
                return points[0]

        return None

    def delete_point(self, point_id, user_id=None):
        user_id = user_id or self.user_id
        db = self.db

        delete_point = 'DELETE FROM Nodes WHERE UserID = ? AND ID = ? AND Type = \'Point\''

        try:
            db.execute(delete_point, (
                    user_id,
                    point_id
                ))
        except Exception, e:
            print 'Point %s delete failed: %s' % (point_id, e)
        else:
            db.commit()
            return True

        return False

    def add_point(self, context_id, point_id=None, attributes=None, user_id=None):
        user_id = user_id or self.user_id

        db = self.db
        cursor = db.cursor()

        import sqlite3
        insert_point_attr = 'INSERT INTO Attributes (NodeID, NameSpaceID, Name, Value, Properties) VALUES (?, ?, ?, ?, ?)'
        insert_assoc = 'INSERT INTO Associations (UserID, SourceID, DestID, Key) VALUES (?, ?, ?, ?)'

        attributes = attributes or {}
        try:
            timestamp = attributes[1].get('Time') or time.time()
            if 'Time' in attributes[1]:
                del attributes[1]['Time']

            if point_id:
                insert_point = 'INSERT INTO Nodes (ID, UserID, Type, TimeStamp) VALUES (?, ?, ?, ?)'
                result = cursor.execute(insert_point, (
                    point_id,
                    user_id,
                    'Point',
                    timestamp
                ))
            else:
                insert_point = 'INSERT INTO Nodes (UserID, Type, TimeStamp) VALUES (?, ?, ?)'
                result = cursor.execute(insert_point, (
                    user_id,
                    'Point',
                    timestamp
                ))
                point_id = cursor.lastrowid

            db.execute(insert_assoc, (
                user_id,
                point_id,
                context_id,
                'up'
            ))

            for namespace_id, namespace_attrs in attributes.items():
                for attr_name, attr_val in namespace_attrs.items():
                    if namespace_id == 2001 and attr_name == 'Bonuses':
                        try:
                            attr_val = simplejson.dumps(attr_val)
                        except:
                            attr_val = None

                    db.execute(insert_point_attr, (
                        point_id,
                        namespace_id,
                        attr_name,
                        attr_val,
                        ''
                    ))
        except sqlite3.IntegrityError, e:
            print e, point_id, attributes
        else:
            db.commit()

        return point_id

    def update_point(self, point_id, attributes):
        # attributes is a dict of namespaces
        db = self.db

        import sqlite3

        update_point = 'UPDATE Nodes SET TimeStamp = ? WHERE ID = ? AND Type = \'Point\''
        update_point_attr = 'REPLACE INTO Attributes (NodeID, NameSpaceID, Name, Value, Properties) VALUES (?, ?, ?, ?, ?)'

        attributes = attributes or {}
        try:
            if 'Time' in attributes:
                timestamp = attributes.get('Time') or time.time()
                result = db.execute(update_point, (
                    timestamp,
                    point_id
                ))

            for namespace_id, namespace_attrs in attributes.items():
                for attr_name, attr_val in namespace_attrs.items():
                    if namespace_id == 2001 and attr_name == 'Bonuses':
                        try:
                            attr_val = simplejson.dumps(attr_val)
                        except:
                            attr_val = None

                    db.execute(update_point_attr, (
                        point_id,
                        namespace_id,
                        attr_name,
                        attr_val,
                        ''
                    ))

        except sqlite3.IntegrityError, e:
            print e, point_id, attributes
        else:
            db.commit()

        return point_id

    def load(self, user_id, attr_namespaces):
        db = self.db
        context_ids = []

        # Retrieve all contexts for a user with namespaced attributes
        context_query = '''
        SELECT
            Nodes.ID, Nodes.Label, Nodes.Timestamp, Attributes.NameSpaceID, 
                Attributes.Name, Attributes.Value
        FROM
            Nodes
                LEFT OUTER JOIN Attributes ON Nodes.ID = Attributes.NodeID
        WHERE
            Nodes.Type = 'Context'
            AND
            Nodes.UserID = ?
            AND
            (
                Attributes.NameSpaceID IS NULL
                OR
                Attributes.NameSpaceID IN (%s)
            )
        ''' % ','.join(attr_namespaces)
        contexts_result = db.execute(context_query, (user_id, )).fetchall()

        for row in contexts_result:
            context_id, label, timestamp, namespace_id, attr_name, attr_val = row
            context_id = int(context_id)

            if context_id not in context_ids:
                context_ids.append(context_id)
                self.init_context(context_id, label)
                self.set_context_attr(context_id, 1, 'Timestamp', timestamp)

            if namespace_id and attr_name:
                namespace_id = int(namespace_id)
                self.set_context_attr(context_id, namespace_id, attr_name, attr_val)

        # Get all outgoing associations from retrieved contexts
        # TODO: Namespaced/keyed
        assoc_query = '''
        SELECT
            ID, SourceID, DestID, Key
        FROM
            Associations
        WHERE
            UserID = ?
            AND
            SourceID in (%s)
        ''' % ','.join(map(str, context_ids))
        assoc_result = db.execute(assoc_query, (user_id, )).fetchall()

        for row in assoc_result:
            assoc_id, source_id, dest_id, key = row
            self.init_assoc(assoc_id, source_id, dest_id, key)

        return self

    def generate_points(self, rows):
        # Produce useful point structures, merging in the attributes.
        points = {}
        for row in rows:
            point_id, timestamp, context_id, namespace_id, attr_name, attr_val = row

            if not namespace_id:
                namespace_id = 1

            point = points.get(point_id)
            if not point:
                point = {
                    'ID': point_id,
                    '1__ContextID': context_id,
                    '1__Time': timestamp
                }
                points[point_id] = point

            if attr_name:
                if attr_name == 'Bonuses' and attr_val:
                    try:
                        attr_val = simplejson.loads(attr_val)
                    except Exception as e:
                        print 'Error with point ID=%s, Attr Name=%s, Val=%s: %s' % (point_id, attr_name, attr_val, e)
                        attr_val = None

                namespaced_attr_name = '%d__%s' % (namespace_id, attr_name)
                point[namespaced_attr_name] = attr_val

        return points.values()

    def get_leaves(self):
        return filter(lambda c: c.is_leaf(), self.contexts.values())

    def get_interior(self):
        return filter(lambda c: c.is_interior(), self.contexts.values())


if __name__ == '__main__':

    import string
    BASE_LIST = string.digits + string.letters
    BASE_DICT = dict((c, i) for i, c in enumerate(BASE_LIST))

    def decode_id(string):
        reverse_base = BASE_DICT
        length = len(reverse_base)
        ret = 0
        for i, c in enumerate(string[::-1]):
            ret += (length ** i) * reverse_base[c]

        return ret

    in_data_path = './graph.db'
    out_db_path = './sql.db'

    which = 1
    user_id = 1
    if which == 0:
        root_context_id = 'rI'
        g = Graph(root_context_id=decode_id(root_context_id), db_path=out_db_path)

        # Load the full structure
        attr_namespaces = map(str, [1])
        g.load(user_id, attr_namespaces)

        print len(g.contexts.keys()), len(g.associations.keys()), len(g.get_points())

        # Prune to a sub-structure
        g2 = g.prune_to_root(decode_id('wH'))
        print len(g2.contexts.keys()), len(g2.associations.keys()), len(g2.get_points())

        # Test points interval
        print len(g2.get_points(time.time() - (86400 * 120), time.time() - (86400 * 180)))

    if which == 1:
        g = Graph(root_context_id=decode_id('rI'), db_path=out_db_path)

        # Load the full structure
        attr_namespaces = map(str, [1])
        g.load(user_id, attr_namespaces)
        print len(g.contexts.keys()), len(g.associations.keys()), len(g.get_points())

        # Prune to a sub-structure
        g2 = g.prune_to_root(decode_id('wH'))
        print len(g2.contexts.keys()), len(g2.associations.keys()), len(g2.get_points())

        # Test points interval
        print len(g2.get_points(time.time() - (86400 * 120), time.time() - (86400 * 180)))

    if which == 2:
        # Retrieve all points associated with a specific context.
        # Of the point's attributes, retrieve only those which belong to the passed namespaces

        root_context_id = decode_id('mO')
        attr_namespaces = (1, 2)

        g = Graph(root_context_id=root_context_id, db_path=out_db_path, user_id=user_id)
        points = g.get_points(namespaces=attr_namespaces)
        for point in points.values():
            print point

    if which == 3:
        db = sqlite3.connect(out_db_path)

        root_context_id = decode_id('rI')
        anchor_time = int(time.time()) - (86400 * 30)
        end_time = anchor_time - (86400 * 60)
        attr_namespaces = (1, 2)

        # Points for user, under any context, within interval, with namespaced attributes
        g = Graph(root_context_id=root_context_id, db_path=out_db_path, user_id=user_id)
        points = g.get_points(anchor_time=anchor_time, end_time=end_time, namespaces=attr_namespaces)

        print len(points)
        # for point in points.values():    
        #     print point
