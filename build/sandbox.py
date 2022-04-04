#!/usr/bin/env python3
import subprocess
from sys import stdout

print('node version:')
subprocess.check_call(['node', '--version'])
print('npm version:')
subprocess.check_call(['npm', '--version'])
print('env:')
ps = subprocess.Popen(['env'], stdout=subprocess.PIPE)
subprocess.check_call('sort', stdin=ps.stdout)
ps.wait()
