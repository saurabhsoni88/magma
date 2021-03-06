/*
 * Copyright 2020 The Magma Authors.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @flow strict-local
 * @format
 */
import type {WithAlert} from '@fbcnms/ui/components/Alert/withAlert';
import type {mutable_subscriber} from '@fbcnms/magma-api';

import ActionTable from '../../components/ActionTable';
import AddSubscriberButton from './SubscriberAddDialog';
import Button from '@material-ui/core/Button';
import CardTitleRow from '../../components/layout/CardTitleRow';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import Grid from '@material-ui/core/Grid';
import Link from '@material-ui/core/Link';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import NetworkContext from '../../components/context/NetworkContext';
import PeopleIcon from '@material-ui/icons/People';
import React from 'react';
import ReactJson from 'react-json-view';
import SubscriberContext from '../../components/context/SubscriberContext';
import SubscriberDetail from './SubscriberDetail';
import Text from '../../theme/design-system/Text';
import TopBar from '../../components/TopBar';
import withAlert from '@fbcnms/ui/components/Alert/withAlert';

import {FEG_LTE} from '@fbcnms/types/network';
import {Redirect, Route, Switch} from 'react-router-dom';
import {colors, typography} from '../../theme/default';
import {makeStyles} from '@material-ui/styles';
import {useContext, useState} from 'react';
import {useEnqueueSnackbar} from '@fbcnms/ui/hooks/useSnackbar';
import {useRouter} from '@fbcnms/ui/hooks';

const TITLE = 'Subscribers';

const useStyles = makeStyles(theme => ({
  dashboardRoot: {
    margin: theme.spacing(5),
  },
  appBarBtn: {
    color: colors.primary.white,
    background: colors.primary.comet,
    fontFamily: typography.button.fontFamily,
    fontWeight: typography.button.fontWeight,
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,

    '&:hover': {
      background: colors.primary.mirage,
    },
  },
  appBarBtnSecondary: {
    color: colors.primary.white,
  },
}));

export default function SubscriberDashboard() {
  const {relativePath, relativeUrl} = useRouter();
  return (
    <Switch>
      <Route
        path={relativePath('/overview/:subscriberId')}
        component={SubscriberDetail}
      />

      <Route
        path={relativePath('/overview')}
        component={SubscriberDashboardInternal}
      />
      <Redirect to={relativeUrl('/overview')} />
    </Switch>
  );
}

type SubscriberRowType = {
  name: string,
  imsi: string,
  activeApns?: number,
  activeSessions?: number,
  service: string,
  currentUsage: string,
  dailyAvg: string,
  lastReportedTime: Date,
};

type SubscriberSessionRowType = {
  apnName: string,
  sessionId: string,
  state: string,
  activeDuration: string,
  activePolicies: Array<string>,
};

function SubscriberDashboardInternal() {
  const classes = useStyles();
  return (
    <>
      <TopBar
        header={TITLE}
        tabs={[
          {
            label: 'Subscribers',
            to: '/subscribersv2',
            icon: PeopleIcon,
            filters: (
              <Grid
                container
                justify="flex-end"
                alignItems="center"
                spacing={2}>
                <Grid item>
                  {/* TODO: these button styles need to be localized */}
                  <Button variant="text" className={classes.appBarBtnSecondary}>
                    Secondary Action
                  </Button>
                </Grid>
                <Grid item>
                  <Button variant="contained" className={classes.appBarBtn}>
                    Primary Action
                  </Button>
                </Grid>
              </Grid>
            ),
          },
        ]}
      />
      <SubscriberTable />
    </>
  );
}

type Props = {
  open: boolean,
  onClose?: () => void,
  imsi: string,
};

function JsonDialog(props: Props) {
  const ctx = useContext(SubscriberContext);
  const sessionState = ctx.sessionState[props.imsi] || {};
  const configuredSubscriberState = ctx.state[props.imsi];
  const subscriber: mutable_subscriber = {
    ...configuredSubscriberState,
    state: sessionState,
  };
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth={true}>
      <DialogTitle>{props.imsi}</DialogTitle>
      <DialogContent>
        <ReactJson
          src={subscriber}
          enableClipboard={false}
          displayDataTypes={false}
        />
      </DialogContent>
    </Dialog>
  );
}

function SubscriberTableRaw(props: WithAlert) {
  const classes = useStyles();
  const {history, relativeUrl} = useRouter();
  const [currRow, setCurrRow] = useState<SubscriberRowType>({});
  const ctx = useContext(SubscriberContext);
  const networkCtx = useContext(NetworkContext);
  const subscriberMap = ctx.state;
  const sessionState = ctx.sessionState;
  const subscriberMetrics = ctx.metrics;
  const enqueueSnackbar = useEnqueueSnackbar();
  const [jsonDialog, setJsonDialog] = useState(false);
  const tableColumns = [
    {title: 'Name', field: 'name'},
    {
      title: 'IMSI',
      field: 'imsi',
      render: currRow => {
        const subscriberConfig = subscriberMap[currRow.imsi];
        return (
          <Link
            variant="body2"
            component="button"
            onClick={() =>
              // Link to event tab if FEG_LTE network
              history.push(
                relativeUrl(
                  '/' +
                    currRow.imsi +
                    `${
                      networkCtx.networkType === FEG_LTE && !subscriberConfig
                        ? '/event'
                        : ''
                    }`,
                ),
              )
            }>
            {currRow.imsi}
          </Link>
        );
      },
    },
    {title: 'Service', field: 'service', width: 100},
    {title: 'Current Usage', field: 'currentUsage', width: 175},
    {title: 'Daily Average', field: 'dailyAvg', width: 175},
    {
      title: 'Last Reported Time',
      field: 'lastReportedTime',
      type: 'datetime',
      width: 200,
    },
  ];

  const subscribersIds = Array.from(
    new Set([...Object.keys(subscriberMap), ...Object.keys(sessionState)]),
  );

  const tableData: Array<SubscriberRowType> = subscribersIds.map(
    (imsi: string) => {
      const subscriberInfo = subscriberMap[imsi] || {};
      const metrics = subscriberMetrics?.[`${imsi}`];
      return {
        name: subscriberInfo.name ?? imsi,
        imsi: imsi,
        service: subscriberInfo.lte?.state || '',
        currentUsage: metrics?.currentUsage ?? '0',
        dailyAvg: metrics?.dailyAvg ?? '0',
        lastReportedTime: new Date(
          subscriberInfo.monitoring?.icmp?.last_reported_time ?? 0,
        ),
      };
    },
  );

  const onClose = () => setJsonDialog(false);

  return (
    <div className={classes.dashboardRoot}>
      <JsonDialog open={jsonDialog} onClose={onClose} imsi={currRow.imsi} />
      <Grid container spacing={4}>
        <Grid item xs={12}>
          <CardTitleRow
            icon={PeopleIcon}
            label={TITLE}
            filter={AddSubscriberButton}
          />

          {subscriberMap || sessionState ? (
            <div>
              <ActionTable
                data={
                  !Object.keys(sessionState).length
                    ? tableData
                    : tableData.map(row => {
                        const subscriber =
                          sessionState[row.imsi]?.subscriber_state || {};
                        const sessions = Object.keys(subscriber || {}).map(
                          apn =>
                            subscriber[apn].filter(
                              session =>
                                session.lifecycle_state === 'SESSION_ACTIVE',
                            ).length,
                        );
                        return {
                          ...row,
                          activeApns: Object.keys(
                            sessionState[row.imsi]?.subscriber_state || {},
                          ).length,
                          activeSessions: sessions.length
                            ? sessions.reduce((a, b) => a + b)
                            : 0,
                        };
                      })
                }
                columns={
                  !Object.keys(sessionState).length
                    ? tableColumns
                    : [
                        ...tableColumns,
                        {title: 'Active APNs', field: 'activeApns'},
                        {title: 'Active Sessions', field: 'activeSessions'},
                      ]
                }
                handleCurrRow={(row: SubscriberRowType) => setCurrRow(row)}
                menuItems={
                  networkCtx.networkType === FEG_LTE
                    ? [
                        {
                          name: 'View JSON',
                          handleFunc: () => {
                            setJsonDialog(true);
                          },
                        },
                      ]
                    : [
                        {
                          name: 'View JSON',
                          handleFunc: () => {
                            setJsonDialog(true);
                          },
                        },
                        {
                          name: 'View',
                          handleFunc: () => {
                            history.push(relativeUrl('/' + currRow.imsi));
                          },
                        },
                        {
                          name: 'Edit',
                          handleFunc: () => {
                            history.push(
                              relativeUrl('/' + currRow.imsi + '/config'),
                            );
                          },
                        },
                        {
                          name: 'Remove',
                          handleFunc: () => {
                            props
                              .confirm(
                                `Are you sure you want to delete ${currRow.imsi}?`,
                              )
                              .then(async confirmed => {
                                if (!confirmed) {
                                  return;
                                }

                                try {
                                  await ctx.setState?.(currRow.imsi);
                                } catch (e) {
                                  enqueueSnackbar(
                                    'failed deleting subscriber ' +
                                      currRow.imsi,
                                    {
                                      variant: 'error',
                                    },
                                  );
                                }
                              });
                          },
                        },
                      ]
                }
                options={{
                  actionsColumnIndex: -1,
                  pageSizeOptions: [10, 20],
                }}
                detailPanel={
                  !Object.keys(sessionState).length
                    ? []
                    : [
                        {
                          icon: () => {
                            return <ExpandMore data-testid="details" />;
                          },
                          openIcon: ExpandLess,
                          render: rowData => {
                            const subscriber =
                              sessionState[rowData.imsi]?.subscriber_state ||
                              {};
                            const subscriberSessionRows: Array<SubscriberSessionRowType> = [];
                            Object.keys(subscriber).map((apn: string) => {
                              subscriber[apn].map(infos => {
                                subscriberSessionRows.push({
                                  apnName: apn,
                                  sessionId: infos.session_id,
                                  state: infos.lifecycle_state,
                                  activeDuration: `${infos.active_duration_sec} sec`,
                                  activePolicies: infos.active_policy_rules,
                                });
                              });
                            });

                            return (
                              <ActionTable
                                data-testid="detailPanel"
                                title=""
                                data={subscriberSessionRows}
                                columns={[
                                  {title: 'APN Name', field: 'apnName'},
                                  {title: 'Session ID', field: 'sessionId'},
                                  {title: 'State', field: 'state'},
                                  {
                                    title: 'Active Duration',
                                    field: 'activeDuration',
                                  },
                                  {
                                    title: 'Active Policy IDs',
                                    field: 'activePolicies',
                                    render: currRow =>
                                      currRow.activePolicies.length ? (
                                        <List>
                                          {currRow.activePolicies.map(
                                            policy => (
                                              <ListItem key={policy.id}>
                                                <Link>{policy.id} </Link>
                                              </ListItem>
                                            ),
                                          )}
                                        </List>
                                      ) : (
                                        <Text>{'-'}</Text>
                                      ),
                                  },
                                ]}
                                options={{
                                  actionsColumnIndex: -1,
                                  pageSizeOptions: [5],
                                  toolbar: false,
                                  paging: false,
                                  rowStyle: {background: '#f7f7f7'},
                                  headerStyle: {
                                    background: '#f7f7f7',
                                    color: colors.primary.comet,
                                  },
                                }}
                              />
                            );
                          },
                        },
                      ]
                }
              />
            </div>
          ) : (
            '<Text>No Subscribers Found</Text>'
          )}
        </Grid>
      </Grid>
    </div>
  );
}
const SubscriberTable = withAlert(SubscriberTableRaw);
