#!/usr/bin/bash

BRANCH=master
START_DATE=$1
END_DATE=$2

START_COMMIT="$(git rev-list -n1 --before=${START_DATE} ${BRANCH})"
END_COMMIT="$(git rev-list -n1 --before=${END_DATE} ${BRANCH})"

echo "Start commit for ${START_DATE} is ${START_COMMIT}"
echo "End commit for ${END_DATE} is ${END_COMMIT}"

npx cloc --git --diff ${START_COMMIT} ${END_COMMIT}

#git diff --no-renames --numstat ${START_COMMIT}..${END_COMMIT} | ruby -rset -e '
#  x = {}
#  while gets
#    line = $_.chomp.split("\t")
#    chunks = line[2].split(".")
#    next if chunks.length == 1
#    type = chunks[-1]
#    x[type] ||= [0, 0, Set.new]
#    2.times { |i| x[type][i] += line[i].to_i }
#    x[type][2] << line[2]
#  end
#  x.sort_by { |(k, v)| k }.each do |(type, (add, del, set))|
#    puts ".#{type} #{set.length} files changed, #{add} insertions(+), #{del} deletions(-)"
#  end'

