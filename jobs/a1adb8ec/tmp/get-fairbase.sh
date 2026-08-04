#!/usr/bin/env bash
grep -B1 -A1 'FAIR BASE' /root/bfclproj/fairbase.log | grep -v '^--$'
