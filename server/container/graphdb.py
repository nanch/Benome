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
import os

import networkx

from benome.utils import CompactID

class IDSequencer(object):
    def __init__(self, g, initial_val=None, increment=None):
        if initial_val is None:
            initial_val = 1000

        if increment is None:
            increment = 50

        self.g = g
        self.increment = increment
        self.num_calls = 0

        seq_vertex = self._get_or_create_vertex('cc', {
            'lastval': initial_val
            })

        initial_val = seq_vertex.lastval + increment

        max_id = max(filter(lambda x: x < 999999999999, map(CompactID._base_decode, self.g.g.node.keys())))

        while initial_val < max_id:
            initial_val += increment

        seq_vertex.lastval = initial_val
        self.seq_vertex = seq_vertex

        self.compact_id = CompactID(initial_val)

    def __call__(self, *args, **kwargs):
        self.num_calls += 1
        if self.num_calls > self.increment:
            self.seq_vertex.lastval += self.increment

            self.num_calls = 0

        return self.compact_id(*args, **kwargs)

    def current_value(self, encoded=False):
        return self.compact_id.current(encoded=encoded)

    def get_block(self, block_size=1000):
        block_begin, block_end = self.compact_id.block(block_size)
        self.seq_vertex.lastval = block_end

        return block_begin, block_end

    def set(self, new_val):
        self.seq_vertex.lastval = new_val
        new_val_encoded = self.compact_id._base_encode(new_val)
        
        return self.compact_id(encoded=new_val_encoded, inc=0)

    def _get_or_create_vertex(self, sid, properties=None):
        if not properties:
            properties = {}

        vertex = self.g.get_point(sid)
        if not vertex:
            self.g.add_point(sid, **properties)
            vertex = self.g.get_point(sid)

        return vertex


class Vertex(object):
    _private = ['g', 'sid']

    def __init__(self, g, sid):
        self.g = g
        self.sid = sid

    def __setattr__(self, name, value):
        if name in self._private:
            object.__setattr__(self, name, value)
        else:
            self.g.g.node[self.sid][name] = value

    def __getattr__(self, name):
        try:
            return self.g.g.node[self.sid].get(name)
        except:
            raise AttributeError(name)

    def __getitem__(self, name):
        return self.get(name)

    def __setitem__(self, name, value):
        self.g.g.node[self.sid][name] = value

    def __repr__(self):
        return '<Vertex %s>' % self.sid

    def get(self, name, default_value=None):
        return getattr(self, name, default_value)

    def delete(self):
        self.g.g.remove_node(self.sid)

    def data(self):
        return self.g.g.node[self.sid]

    def outE(self, edge_name):

        return []

    def inE(self, edge_name):
        return []

    def outV(self, edge_name=None, ids_only=False):
        return self.g.outV(self.sid, name=edge_name, ids_only=ids_only)

    def inV(self, edge_name=None, ids_only=False):
        return self.g.inV(self.sid, name=edge_name, ids_only=ids_only)


class Edge(object):
    _private = ['g', 'src', 'dest']

    def __init__(self, g, src_sid, dest_sid):
        self.g = g
        self.src = src_sid
        self.dest = dest_sid

    def __setattr__(self, name, value):
        if name in self._private:
            object.__setattr__(self, name, value)
        else:
            self.g.g.edge[self.src][self.dest][name] = value

    def __getattr__(self, name):
        try:
            return self.g.g.edge[self.src][self.dest].get(name)
        except:
            raise AttributeError(name)

    def __repr__(self):
        return '<Edge %s to %s>' % (self.src, self.dest)

    def get(self, name, default_value=None):
        return getattr(self, name, default_value)

    def data(self):
        return self.g.g.edge[self.src][self.dest]

    def outV(self):
        return self.dest

    def inV(self):
        return self.src

        
class GraphDB(object):
    Vertex = Vertex
    Edge = Edge

    def __init__(self, db_path, load=True):
        self.db_path = db_path

        if not load:
            self.g = networkx.DiGraph()
        else:
            self.g = self.load(db_path=self.db_path)

        if type(self.g) is networkx.classes.digraph.DiGraph:
            self.g.controller = self
            self.compact_id = self.new_sequencer()

    def load(self, db_path=None):
        if db_path is None:
            db_path = self.db_path

        if os.path.exists(db_path):
            from networkx.readwrite import json_graph
            import gzip, simplejson

            f = gzip.open(db_path)
            d = simplejson.loads(f.read())
            f.close()

            g = json_graph.node_link_graph(d)

            self.db_path = db_path
        else:
            g = networkx.DiGraph()

        return g

    def save(self, filename=None, fsync=True):
        if filename is None:
            filename = self.db_path

        from networkx.readwrite import json_graph
        import simplejson
        import cjson
        import gzip

        base_path = os.path.split(filename)[0]
        
        g_json = json_graph.node_link_data(self.g)
        ts = int(time.time() * 1000)

        tmp_filename = os.path.join(base_path, '%s.%d.tmp' % (filename, ts))
        try:
            with gzip.open(tmp_filename, 'w', 9) as f:
                f.write(cjson.encode(g_json))
                f.flush()

                if fsync:
                    os.fsync(f)
        except Exception, e:
            try:
                os.remove(tmp_filename)
            except:
                pass

            print 'Phase 1 failed: %s' % e
        else:
            print 'Phase 1 OK'

            # Rename original file if it exists
            if os.path.exists(filename):
                tmp_filename2 = os.path.join(base_path, '%s.%d.old' % (filename, ts))
                os.rename(filename, tmp_filename2)

            print filename

            # Rename new file, revert if there's a problem
            try:
                os.rename(tmp_filename, filename)
            except Exception, e:
                print 'Phase 2 failed: %s' % e
                os.rename(tmp_filename2, filename)
            else:
                try:
                    os.remove(tmp_filename2)
                except:
                    pass

                print 'Phase 2 OK'
                print 'Approximately %d bytes saved, fsync=%s' % (len(str(g_json)), fsync)

        return True

    def new_sequencer(self, initial_val=None, increment=None):
        return IDSequencer(self, initial_val, increment)

    def get_id_block(self, block_size=1000):
        return self.compact_id.get_block(block_size)

    def delete_point(self, sid):
        return self.g.remove_node(sid)

    def add_point(self, sid=None, properties=None, **kwargs):
        if not properties:
            properties = kwargs

        if 'sid' in properties:
            if sid is None:
                sid = properties['sid']

            del properties['sid']

        if sid is None:
            sid = self.compact_id()

        self.g.add_node(sid, **properties)
        return sid

    def add_edge(self, src, name, dest):
        if type(src) is Vertex:
            src = src.sid

        if type(dest) is Vertex:
            dest = dest.sid

        self.g.add_edge(src, dest, {'name': name})

    def remove_edge(self, src, dest):
        if type(src) is Vertex:
            src = src.sid

        if type(dest) is Vertex:
            dest = dest.sid

        self.g.remove_edge(src, dest)

    def add_edges(self, edges):
        self.g.add_edges_from(edges)

    def get_point(self, sid):
        if type(sid) is Vertex:
            return sid

        if sid in self.g.node:
            return Vertex(self, sid)

        return None

    def out_edges(self, sid):
        return self.g.out_edges(sid)

    def outE(self, sid, name=None, ids_only=False):
        result = []

        for current_vert, out_vert in self.g.out_edges(sid):
            if not name:
                result.append((current_vert, out_vert))
            else:
                edge_name = self.g.edge[current_vert][out_vert].get('name')
                if edge_name == name:
                    result.append((current_vert, out_vert))

        if not ids_only:
            result = self.to_edge(result)

        return result

    def inE(self, sid, name=None, ids_only=False):
        result = []

        for other_vert, current_vert in self.g.in_edges(sid):
            if not name:
                result.append((other_vert, current_vert))
            else:
                edge_name = self.g.edge[other_vert][current_vert].get('name')
                if edge_name == name:
                    result.append((other_vert, current_vert))

        if not ids_only:
            result = self.to_edge(result)

        return result

    def outV(self, sid, name=None, ids_only=False):
        vertex_sids = [edge.outV() for edge in self.outE(sid, name=name)]

        if not ids_only:
            return self.to_vertex(vertex_sids)
        else:
            return vertex_sids

    def inV(self, sid, name=None, ids_only=False):
        vertex_sids = [edge.inV() for edge in self.inE(sid, name=name)]

        if not ids_only:
            return self.to_vertex(vertex_sids)
        else:
            return vertex_sids

    def to_vertex(self, sids):
        return [Vertex(self, sid) for sid in sids]

    def to_edge(self, edges):
        return [Edge(self, v1, v2) for v1, v2 in edges]

    def get_by_property(self, property_name):
        nodes = []
        # TODO: Use a hub node with an easily discovered ID
        for sid, node_properties in self.g.node.items():
            if node_properties.get(property_name):
                nodes.append(self.get_point(sid))

        return nodes

