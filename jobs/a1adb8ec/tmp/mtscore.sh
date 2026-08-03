#!/bin/bash
echo "--- multi_turn scores so far ---"
cat ~/bfclproj/score/data_multi_turn.csv 2>/dev/null | head -4
echo "--- overall row ---"
cat ~/bfclproj/score/data_overall.csv 2>/dev/null | tail -2 | cut -c1-260
