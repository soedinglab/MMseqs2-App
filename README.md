# MMseqs2 App and Server

[MMseqs2](https://github.com/soedinglab/MMseqs2) is a software suite to search and annotate huge sequence sets. We built a graphical interface to make it more useful for interactive data exploration. Check out an live instance [here](https://search.mmseqs.com).

The application runs either:
* on your workstation as a cross-platform desktop application with the help of the [electron framework](https://github.com/electron/electron)
* on your server through docker-compose, where it can make your sequence or profile databases easily accessible over the web

<p align="center"><img src="https://raw.githubusercontent.com/soedinglab/mmseqs2-app/master/frontend/assets/marv-search_1x.png" height="256" /></p>

## Desktop App

Head over to the [release page](https://github.com/soedinglab/MMseqs2-App/releases) and download the latest version. We currently support Linux, macOS and Windows.

### Adding a search database
Once the app is installed, open the Settings panel. There you can add either sequence databases in FASTA format, such as our [Uniclust](https://uniclust.mmseqs.com/) databases or profile databases in Stockholm format, such as the [PFAM](ftp://ftp.ebi.ac.uk/pub/databases/Pfam/current_release/Pfam-A.full.gz).

## Web app quickstart with docker-compose

Make sure you have `docker` (>=17.05), `docker-compose` (>=1.20.0) and `git` installed on your server.
To start the MMseqs2 web server execute the following commands. Afterwards you can navigate to http://localhost:8877 on a webserver to access the interface.

``` bash
# clone the repository
git clone https://github.com/soedinglab/MMseqs2-App.git

# navigate to our docker recipes
cd MMseqs2-App/docker-compose

# download the uniclust sequence database
./examples/uniclust/setup.sh

# start the server with docker-compose
docker-compose up
```

By default, the server will start on port 8877. You can edit the `.env` file in the `docker-compose` directory to change this port.

Head over to the [Docker recipe readme](https://github.com/soedinglab/MMseqs2-App/blob/master/docker-compose/README.md) for more details on running your own server, including how to add your own sequence or profile databases. Take a look at the [API documentation](https://search.mmseqs.com/docs) to learn how to talk to the server backend.

## Building the desktop app

You need to have `git`, `go`, `node`, `npm` and `make` installed on your system.

Afterwards run the following commands, and the apps will appear in the `build` folder.

``` bash
# clone the repository
git clone https://github.com/soedinglab/MMseqs2-App.git
cd MMseqs2-App

# install all dependencies
npm install

# build the app for all platforms
npm run electron:build
```

