#!/usr/bin/python

import sys
import os

def shell(cmd):
    import subprocess
    subprocess.Popen(cmd, shell=True, stdout=None, stderr=None)

def write_container_conf(username):
    template_path = '/opt/benome/src/deploy/container_template.conf'
    dest_path = '/home/benome/supervisor/container_{0}.conf'.format(username)

    with open(template_path, 'r') as f:
        config = f.read()
        rendered_config = config.format(username=username)

    with open(dest_path, 'w') as f:
        f.write(rendered_config)

    return True

def get_next_port():
    from users import get_users
    u = get_users()
    ports = map(int, [user_data['Config'].get('LocalPort', 0) for user_data in u])
    last_port = max(ports) or 25000
    return last_port + 1

def create_user(username, password, include_apps=None, email_address=None, origin=None):
    if not username:
        raise Exception('Username required')

    if not username.isalnum():
        raise Exception('Username must be alphanumeric')

    if len(username) > 32 or len(username) < 4:
        raise Exception('Invalid username length. Must be between 4 and 32 chars')

    if not password:
        raise Exception('Password required')

    if 8 > len(password) > 64:
        raise Exception('Invalid password length. Must be between 8 and 64 chars')

    if email_address:
        from validate_email import validate_email
        if not validate_email(email_address):
            raise Exception('Email address is malformed')

    if origin and not origin.isalnum():
        raise Exception('Invalid origin field')

    import_json = None
    if origin == 'Happiness':
        import_json = ('UserRoot', True, '/opt/benome/struct/Happiness.json')

    from users import add_user, set_user_config
    from init_db import init_db

    try:
        os.mkdir('/opt/benome/data/{0}'.format(username))
        db_path = '/opt/benome/data/{0}/sql.db'.format(username)
        init_db(db_path, include_apps=include_apps, import_json=import_json)
    except Exception as e:
        # TODO: Remove the data dir
        print e
        raise Exception('Error initializing data')
    else:
        try:
            add_user(username, password)
            set_user_config(username, 'ContainerType', 'Local')
            port = get_next_port()
            set_user_config(username, 'LocalPort', str(port))

            if email_address:
                set_user_config(username, 'EmailAddress', email_address)

            if origin:
                set_user_config(username, 'Origin', origin)

            write_container_conf(username)
            shell('supervisorctl update')
        except Exception as e:
            print e
            raise Exception('Error initializing user.')

    return True


if __name__ == '__main__':
    import sys
    username = sys.argv[1]
    password = sys.argv[2]
    email_address = sys.argv[3]
    origin = sys.argv[4]

    create_user(username, password, email_address=email_address, origin=origin)