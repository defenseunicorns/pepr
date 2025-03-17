#!/bin/bash

jq -r '.[] | .jobs[] | select(.failures > 0) | .job_name + " " + (.failures | tostring)' /Users/sam.mayer/code/work/pepr/e2e-30d.log | awk '{arr[$1]+=$2} END {for (i in arr) print i, arr[i]}' | sort -k2 -nr > failures.dat

gnuplot -persist <<-EOF
set terminal png size 800,600
set output 'failures_histogram.png'
set title 'Histogram of Failures by Job Name'
set xlabel 'Job Name'
set ylabel 'Number of Failures'
set style fill solid
set boxwidth 0.5
set xtic rotate by -90
set grid
set arrow from graph 0, first 8 to graph 1, first 8 nohead lc rgb "red" lw 1
set arrow from graph 0, first 5 to graph 1, first 5 nohead lc rgb "green" lw 1
plot 'failures.dat' using 2:xtic(1) with histogram title 'Failures'
EOF