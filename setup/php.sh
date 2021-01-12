#!/usr/bin/env bash

#curl -L -O https://github.com/phpbrew/phpbrew/releases/latest/download/phpbrew.phar
#chmod +x phpbrew.phar

# Move the file to some directory within your $PATH
#sudo mv phpbrew.phar /usr/local/bin/phpbrew

#phpbrew init
#phpbrew lookup-prefix homebrew
phpbrew update

phpbrew --debug install 7.3 +default +opcache +fpm
phpbrew --debug install 7.4 +default +opcache +fpm
phpbrew switch 7.4

phpbrew --debug ext install apcu stable
phpbrew --debug ext install xdebug stable
phpbrew --debug ext install redis stable
phpbrew --debug ext install memcached stable -- --disable-memcached-sasl

# Install Composer
EXPECTED_SIGNATURE="$(curl -fsSL https://composer.github.io/installer.sig)"
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
ACTUAL_SIGNATURE="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"
if [ "$EXPECTED_SIGNATURE" != "$ACTUAL_SIGNATURE" ]; then
    echo 'ERROR: Invalid Composer installer signature'
    rm composer-setup.php
else
    php composer-setup.php --quiet
    rm composer-setup.php
    echo 'move composer to /usr/local/bin/composer'
    sudo mv -f composer.phar /usr/local/bin/composer
    PATH="$HOME/.composer/vendor/bin:$PATH"
fi

composer global require "squizlabs/php_codesniffer"
sudo ln -s ~/.composer/vendor/bin/phpcs /usr/local/bin/phpcs

composer global require "friendsofphp/php-cs-fixer"
sudo ln -s ~/.composer/vendor/bin/php-cs-fixer /usr/local/bin/php-cs-fixer

composer global require "phpmd/phpmd"
ln -s ~/.composer/vendor/bin/phpmd /usr/local/bin/phpmd

composer global require "laravel/valet"

echo
