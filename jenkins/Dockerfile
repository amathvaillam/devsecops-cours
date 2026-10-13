# Image Jenkins du TP : Jenkins + le CLI Docker.
#
# Pourquoi ? Jenkins va exécuter des commandes `docker build`, `docker run`,
# `docker push` dans ses étapes de pipeline. Le CLI Docker est donc embarqué
# ici (copié depuis l'image officielle docker:cli, avec buildx et compose).
# Au démarrage du conteneur, on monte le socket Docker de la machine hôte :
#   -v /var/run/docker.sock:/var/run/docker.sock
# → le Jenkins "pilote" le Docker de la machine, sans installer quoi que ce soit d'autre.
FROM jenkins/jenkins:lts

COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
