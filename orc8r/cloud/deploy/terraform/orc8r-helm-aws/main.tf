################################################################################
# Copyright 2020 The Magma Authors.

# This source code is licensed under the BSD-style license found in the
# LICENSE file in the root directory of this source tree.

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
################################################################################

data "terraform_remote_state" "current" {
  backend = var.state_backend
  config  = var.state_config

  defaults = {
    orc8r_tag = "latest"
  }
}

locals {
  orc8r_tag = var.orc8r_tag == "" ? data.terraform_remote_state.current.outputs.orc8r_tag : var.orc8r_tag
}

resource "helm_release" "orc8r" {
  name                = var.helm_deployment_name
  namespace           = kubernetes_namespace.orc8r.metadata[0].name
  repository          = var.helm_repo
  repository_username = var.helm_user
  repository_password = var.helm_pass
  chart               = "orc8r"
  version             = var.orc8r_chart_version
  keyring             = ""
  timeout             = 600

  values = [templatefile("${path.module}/templates/orc8r-values.tpl", {
    image_pull_secret = kubernetes_secret.artifactory.metadata.0.name
    docker_registry   = var.docker_registry
    docker_tag        = local.orc8r_tag

    certs_secret   = kubernetes_secret.orc8r_certs.metadata.0.name
    configs_secret = kubernetes_secret.orc8r_configs.metadata.0.name
    envdir_secret  = kubernetes_secret.orc8r_envdir.metadata.0.name
    # We need to define this variable so the template renders properly, but the
    # right k8s secret won't exist unless deploy_nms is set to true.
    # So if deploy_nms is set to false, we'll just this secret name to the
    # orc8r certs secret
    nms_certs_secret = var.deploy_nms ? kubernetes_secret.nms_certs.0.metadata.0.name : kubernetes_secret.orc8r_certs.metadata.0.name

    controller_replicas = var.orc8r_controller_replicas
    nginx_replicas      = var.orc8r_proxy_replicas

    controller_hostname = format("controller.%s", var.orc8r_domain_name)
    api_hostname        = format("api.%s", var.orc8r_domain_name)
    nms_hostname        = format("*.nms.%s", var.orc8r_domain_name)

    orc8r_db_name = var.orc8r_db_name
    orc8r_db_host = var.orc8r_db_host
    orc8r_db_port = var.orc8r_db_port
    orc8r_db_user = var.orc8r_db_user

    deploy_nms  = var.deploy_nms
    nms_db_name = var.nms_db_name
    nms_db_host = var.nms_db_host
    nms_db_user = var.nms_db_user

    metrics_pvc_promcfg  = kubernetes_persistent_volume_claim.storage["promcfg"].metadata.0.name
    metrics_pvc_promdata = kubernetes_persistent_volume_claim.storage["promdata"].metadata.0.name

    create_usergrafana             = true
    user_grafana_hostname          = format("%s-user-grafana:3000", var.helm_deployment_name)
    grafana_pvc_grafanaData        = kubernetes_persistent_volume_claim.storage["grafanadata"].metadata.0.name
    grafana_pvc_grafanaDatasources = kubernetes_persistent_volume_claim.storage["grafanadatasources"].metadata.0.name
    grafana_pvc_grafanaProviders   = kubernetes_persistent_volume_claim.storage["grafanaproviders"].metadata.0.name
    grafana_pvc_grafanaDashboards  = kubernetes_persistent_volume_claim.storage["grafanadashboards"].metadata.0.name

    prometheus_cache_hostname = format("%s-prometheus-cache", var.helm_deployment_name)
    alertmanager_hostname     = format("%s-alertmanager", var.helm_deployment_name)
    alertmanager_url          = format("%s-alertmanager:9093", var.helm_deployment_name)
    prometheus_url            = format("%s-prometheus:9090", var.helm_deployment_name)

    thanos_enabled         = var.thanos_enabled
    thanos_bucket          = var.thanos_enabled ? aws_s3_bucket.thanos_object_store_bucket[0].bucket : ""
    thanos_aws_access_key  = var.thanos_enabled ? aws_iam_access_key.thanos_s3_access_key[0].id : ""
    thanos_aws_secret_key  = var.thanos_enabled ? aws_iam_access_key.thanos_s3_access_key[0].secret : ""

    thanos_compact_selector = var.thanos_compact_node_selector != "" ? format("compute-type: %s", var.thanos_compact_node_selector) : "{}"
    thanos_query_selector   = var.thanos_query_node_selector != "" ? format("compute-type: %s", var.thanos_query_node_selector) : "{}"
    thanos_store_selector   = var.thanos_store_node_selector != "" ? format("compute-type: %s", var.thanos_store_node_selector) : "{}"

    region = var.region
  })]

  set_sensitive {
    name  = "controller.spec.database.pass"
    value = var.orc8r_db_pass
  }

  set_sensitive {
    name  = "nms.magmalte.env.mysql_pass"
    value = var.nms_db_pass
  }
}
