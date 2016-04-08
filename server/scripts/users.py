#!/usr/bin/python

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
import time
import simplejson

from controller.user_manager import UserManager
from controller.container_manager import ContainerManager

user_manager = UserManager()
container_manager = ContainerManager('http://127.0.0.1:5200', '127.0.0.1', user_manager=user_manager)

valid_features = [
    'PointDetail',
    'LeafFocusToggleTimer',
    'LeafFocusAutoAdd',
    'Admin',
    'DetailLevels',
    'MovableFocus',
    'PointShortPress',
    'ActivityPullForward',
    'ActivityPushBack'
]

def get_users():
    return user_manager.get_users()

def get_user_data(username):
    user_data = None
    try:
        user_data = user_manager.get_user(username=username)
    except Exception, e:
        print e

    return user_data

def add_user(username, password=None):
    success = user_manager.add_user(username)
    if success:
        if not password:
            password = username

        return set_user_password(username, password)

def delete_user(username):
    return user_manager.delete_user(username=username)

def get_user_id(username):
    user_data = get_user_data(username)
    return user_data['UserID']

def set_user_password(username, password):
    user_id = get_user_id(username)
    return user_manager.set_password(user_id, password)

def set_user_config(username, attr_name, attr_value=None):
    user_id = get_user_id(username)
    config = dict([(attr_name, attr_value)])
    return user_manager.update_config(user_id, config, replace=False)

def set_user_feature(username, feature_name, feature_enabled=True):
    user_id = get_user_id(username)
    return user_manager.update_feature(user_id, feature_name, feature_enabled)

def test_user_password(username, password):
    user_id = get_user_id(username)
    return user_manager.auth_user(user_id, password)

def stop_container(username, kill=False, remove=False):
    user_id = get_user_id(username)
    return container_manager.shutdown_container(user_id, kill=kill, remove=remove)

def start_container(username, container_name=None):
    if not container_name:
        container_name = username
    user_id = get_user_id(username)
    return container_manager.ensure_container(user_id, container_name=container_name, user_is_valid=True)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()

    subparsers = parser.add_subparsers(dest='command')
    for command in ('list', 'features', 'get', 'delete', 'add', 'config', 'feature', 'setpw', 'testpw', 'start', 'stop', 'stopall'):
        subparser = subparsers.add_parser(command)
        if command not in ('list', 'features', 'stopall'):
            subparser.add_argument('user', help='User name', type=str)
        elif command == 'stopall':
            subparser.add_argument('-d', '--destroy', help='Destroy the containers', action='store_true')

        if command == 'config':
            subparser.add_argument('name', help='Attribute name', type=str)
            subparser.add_argument('value', help='Attribute value', type=str)

        if command == 'feature':
            subparser.add_argument('name', help='Feature name', type=str)
            subparser.add_argument('enabled', help='1 to enable, 0 to disable', type=int,  choices=[1, 0])

        if command == 'add':
            subparser.add_argument('-p', '--password', help='Password', type=str)
        elif command in ('setpw', 'testpw'):
            subparser.add_argument('password', help='Password', type=str)

        if command == 'stop':
            subparser.add_argument('-r', '--remove', help='Remove the container', action='store_true')
            subparser.add_argument('-k', '--kill', help='Kill the container', action='store_true')

        if command == 'start':
            subparser.add_argument('-c', '--container', help='Container name', type=str, required=False)

    args = parser.parse_args()

    cmd = args.command

    if cmd == 'list':
        for user in get_users():
            print user

    elif cmd == 'features':
        # Print all possible features
        print ''
        print '\n'.join(valid_features)
        print ''

    elif cmd in ('get', 'delete', 'add', 'config', 'setpw', 'testpw', 'start', 'stop', 'feature'):
        user_name = args.user

        if cmd == 'get':
            print simplejson.dumps(get_user_data(user_name), indent=4)

        elif cmd == 'delete':
            delete_user(user_name)

        elif cmd == 'config':
            attr_name = args.name
            attr_value = args.value

            if not set_user_config(user_name, attr_name, attr_value):
                print 'Attribute set failed'
            print simplejson.dumps(get_user_data(user_name), indent=4)

        elif cmd == 'feature':
            feature_name = args.name
            feature_enabled = args.enabled

            if feature_name not in valid_features:
                print 'Invalid feature. Valid features are: %s' % valid_features
                exit()

            if not set_user_feature(user_name, feature_name, feature_enabled):
                print 'Feature change failed'
            print simplejson.dumps(get_user_data(user_name), indent=4)

        elif cmd in ('add', 'setpw', 'testpw'):
            password = args.password
            if cmd == 'add':
                add_user(user_name, password)

            elif cmd == 'setpw':
                print set_user_password(user_name, password)

            elif cmd == 'testpw':
                print test_user_password(user_name, password)

        elif cmd == 'stop':
            remove = args.remove
            kill = args.kill
            stop_container(user_name, kill=kill, remove=remove)

        elif cmd == 'start':
            container_name = args.container
            start_container(user_name, container_name)

    elif cmd == 'stopall':
        destroy = args.destroy
        kill = destroy
        remove = destroy

        for user in get_users():
            user_id = user['UserID']

            print 'Stopping container for user %s (%s)' % (user['Username'], user_id)
            stop_container(user_id, kill=kill, remove=remove)

    else:
        print 'Unknown command: %s' % cmd
