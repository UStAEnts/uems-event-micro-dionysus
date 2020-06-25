docker build --tag uems-dionysus:0.1 .
docker run --publish 15670:15670 --detach uems-dionysus:0.1
