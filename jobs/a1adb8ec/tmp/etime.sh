#!/usr/bin/env bash
ps -eo pid,etime,args | grep "[t]rain_student_generic" | head -2
