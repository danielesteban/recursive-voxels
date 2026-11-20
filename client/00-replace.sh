#!/bin/sh
for file in /usr/share/nginx/html/assets/*.js
do
sed -E \
"s@__SERVER__@$SERVER@g" \
< "$file" | sponge "$file"
done
