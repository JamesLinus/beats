angular.module('Beats.filters', [])
// A filter that takes a number of seconds and converts it to MM:SS format
.filter('momentFormat', function()
{
    return function(input)
    {
        var seconds = (Math.floor(input) % 60);
        if (seconds < 10)
        {
            seconds = "0" + seconds;
        }
        return Math.floor(input / 60) + ":" + seconds;
    };
});

angular.module('BeatsApp', ['Beats.filters', 'ngCookies'])
.directive('takeFocus', function($timeout)
{
    // Directive used to focus on an element when the variable under takeFocus becomes true
    return {
        link: function(scope, element, attrs)
        {
            // Watch the variable under takeFocus
            scope.$watch(attrs.takeFocus, function(value)
            {
                // We should take focus to this element
                if (value === true)
                {
                    // A tiny timeout is required for the element to be rendered and be able to take
                    // focus
                    $timeout(function()
                    {
                        element[0].focus();
                        // Reset the focus variable so this action can be repeated
                        scope[attrs.takeFocus] = false;
                    });
                }
            });
        }
    };
})
.controller('BeatsController', ['$scope', '$http', '$interval', '$cookies', function($scope, $http, $interval, $cookies)
{
    var backendBase = 'http://127.0.0.1:5000'
    $scope.showDialog = false;
    $scope.loggedIn = null;
    $scope.playlist = [];
    $scope.queue = [];
    $scope.volume = 100;
    $scope.playbackTime = 0;
    $scope.playbackDuration = 0;

    $scope.sections =
    [
        { title: 'Queue', icon: '\uf03a', query: '' },
        { title: 'Recently Added', icon: '\uf017', query: '' },
        { title: 'Recently Played', icon: '\uf04b', query: 'play-history' },
        { title: 'Random', icon: '\uf074', query: '' },
        { title: 'Top 100', icon: '\uf01b', query: 'top-songs:100' },
    ];

    $scope.playlists =
    [
        { title: 'Rock' },
        { title: 'Pop' },
        { title: 'Top 40' },
        { title: 'Hardcore' },
        { title: 'Witch-Hop' },
    ];


    $scope.login = function(username, password)
    {
        $scope.hideLoginDialog();
        $http.post(backendBase + '/v1/session', 'username=' + username + '&password=' + password,
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        .success(function(data)
        {
            console.log(data);
            $cookies['crowd.token_key'] = data['token'];
            $scope.requestUser();
        });
    };

    $scope.logout = function()
    {
        $http.delete(backendBase + '/v1/session/' + $cookies['crowd.token_key'])
        .success(function(data)
        {
            delete $cookies['crowd.token_key'];
            $scope.loggedIn = null;
        });
    };

    $scope.ensureLogin = function()
    {
        console.log('crowd.token_key = ' + $cookies['crowd.token_key']);
        if (!$cookies['crowd.token_key']) {
            $scope.showDialog = true;
            $scope.usernameFocus = true;
            return false;
        }
        return true;
    };

    $scope.hideLoginDialog = function()
    {
        $scope.formUsername = '';
        $scope.formPassword = '';
        $scope.showDialog = false;
    }

    $scope.requestUser = function()
    {
        $http.get(backendBase + '/v1/session/' + $cookies['crowd.token_key'])
        .success(function(data)
        {
            $scope.loggedIn = data.user;
        })
        .error(function(data, status)
        {
            // Session expired
            delete $cookies['crowd.token_key'];
        });
    };

    if ($cookies['crowd.token_key'])
    {
        $scope.requestUser();
    }

    $scope.searchSongs = function(query)
    {
        if (!query) {
            $scope.randomSongs();
            return;
        }
        $http.get(backendBase + '/v1/songs/search',
        {
            params: { 'q': query }
        })
        .success(function(data)
        {
            var songs = [];
            for (var resultIndex = 0; resultIndex < data.results.length; resultIndex++)
            {
                var result = data.results[resultIndex];
                songs[resultIndex] = result;
            }
            $scope.playlist = songs;
            $scope.searchText = query;
        });
    }

    $scope.randomSongs = function()
    {
        $http.get(backendBase + '/v1/songs/random')
        .success(function(data)
        {
            var songs = [];
            for (var resultIndex = 0; resultIndex < data.results.length; resultIndex++)
            {
                var result = data.results[resultIndex];
                songs[resultIndex] = result;
            }
            $scope.playlist = songs;
            $scope.searchText = '';
        });
    }

    $scope.randomSongs();

    $scope.voteSong = function(song)
    {
        if (!$scope.ensureLogin()) {
            return;
        }

        $http.post(backendBase + '/v1/queue/add', 'id=' + song.id + '&token=' + $cookies['crowd.token_key'],
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        .success(function(data)
        {
            console.log(data);
        });
    };

    $scope.pauseSong = function()
    {
        if (!$scope.ensureLogin()) {
            return;
        }
        $http.post(backendBase + '/v1/player/pause', 'token=' + $cookies['crowd.token_key'],
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    };

    $scope.skipSong = function()
    {
        if (!$scope.ensureLogin()) {
            return;
        }
        $http.post(backendBase + '/v1/player/play_next', 'token=' + $cookies['crowd.token_key'],
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    };

    $interval(function()
    {
        $http.get(backendBase + '/v1/now_playing')
        .success(function(data)
        {
            if (data['media']) {
                $scope.playbackTime = data['player_status']['current_time'] / 1000;
                $scope.playbackDuration = data['player_status']['duration'] / 1000;
            }
            else {
                $scope.playbackTime = 0;
                $scope.playbackDuration = 0;
            }
            $scope.volume = data['player_status']['volume'];
        });

        $http.get(backendBase + '/v1/queue')
        .success(function(data)
        {
            $scope.queue = data['queue'].slice(data['position']);
        });
    }, 1000);
}]);

function makeSong(title, albumTitle, trackNum, artist, length)
{
    return {
        title:      title,
        albumTitle: albumTitle,
        trackNum:   trackNum,
        artist:     artist,
        length:     length,
    };
}

