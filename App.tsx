import React, { Component } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import RtcEngine, {
  RtcLocalView,
  RtcRemoteView,
  VideoRenderMode,
  ClientRole,
  ChannelProfile,
} from 'react-native-agora';

import RNFetchBlob from 'rn-fetch-blob';

import requestCameraAndAudioPermission from './components/Permission';
import styles from './components/Style';

/**
 * @property appId Agora App ID
 * @property token Token for the channel;
 * @property channelName Channel Name for the current session
 */
const token = null;
const appId = '579dd418a824485989bdb75c1f7673fb';
const channelName = 'romyChanel';

export const AGORATOKENURL =
  'https://us-central1-connect-c0152.cloudfunctions.net/app/';

/**
 * @property isHost Boolean value to select between broadcaster and audience
 * @property joinSucceed State variable for storing success
 * @property peerIds Array for storing connected peers
 */
interface State {
  isHost: boolean;
  joinSucceed: boolean;
  peerIds: number[];
  token: any,
  uid: number
}

export default class App extends Component<null, State> {
  _engine?: RtcEngine;

  constructor(props) {
    super(props);
    const uid = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
    this.state = {
      isHost: true,
      joinSucceed: false,
      token: null,
      uid,
      peerIds: [],
    };
    if (Platform.OS === 'android') {
      // Request required permissions from Android
      requestCameraAndAudioPermission().then(() => {
        console.log('requested!');
      });
    }
  }

  componentDidMount() {
    this.init();
  }

  /**
   * @name init
   * @description Function to initialize the Rtc Engine, attach event listeners and actions
   */
  init = async () => {
    const token = await getToken('romyChanel', this.state.uid, 0);

    this.setState({token})

    this._engine = await RtcEngine.create(appId);
    await this._engine.enableVideo();
    await this._engine?.setChannelProfile(ChannelProfile.LiveBroadcasting);
    await this._engine?.setClientRole(
      this.state.isHost ? ClientRole.Broadcaster : ClientRole.Audience
    );

    this._engine.addListener('Warning', (warn) => {
      console.log('Warning', warn);
    });

    this._engine.addListener('Error', (err) => {
      console.log('Error', err);
    });

    this._engine.addListener('UserJoined', (uid, elapsed) => {
      console.log('UserJoined', uid, elapsed);
      // Get current peer IDs
      const { peerIds } = this.state;
      // If new user
      if (peerIds.indexOf(uid) === -1) {
        this.setState({
          // Add peer ID to state array
          peerIds: [...peerIds, uid],
        });
      }
    });

    this._engine.addListener('UserOffline', (uid, reason) => {
      console.log('UserOffline', uid, reason);
      const { peerIds } = this.state;
      this.setState({
        // Remove peer ID from state array
        peerIds: peerIds.filter((id) => id !== uid),
      });
    });

    // If Local user joins RTC channel
    this._engine.addListener('JoinChannelSuccess', (channel, uid, elapsed) => {
      console.log('JoinChannelSuccess', channel, uid, elapsed);
      // Set state variable to true
      this.setState({
        joinSucceed: true,
      });
    });
  };

  /**
   * @name toggleRoll
   * @description Function to toggle the roll between broadcaster and audience
   */
  toggleRoll = async () => {
    // Join Channel using null token and channel name
    this.setState(
      {
        isHost: !this.state.isHost,
      },
      async () => {
        await this._engine?.setClientRole(
          this.state.isHost ? ClientRole.Broadcaster : ClientRole.Audience
        );
      }
    );
  };

  /**
   * @name startCall
   * @description Function to start the call
   */
  startCall = async () => {
    // Join Channel using null token and channel name
    console.log('we join with the token: ', this.state.token)
    await this._engine?.joinChannel(this.state.token, channelName, null, this.state.uid);
  };

  /**
   * @name endCall
   * @description Function to end the call
   */
  endCall = async () => {
    await this._engine?.leaveChannel();
    this.setState({ peerIds: [], joinSucceed: false });
  };

  render() {
    return (
      <View style={styles.max}>
        <View style={styles.max}>
          <Text style={styles.roleText}>
            You're {this.state.isHost ? 'a broadcaster' : 'the audience'}
          </Text>
          <View style={styles.buttonHolder}>
            <TouchableOpacity onPress={this.toggleRoll} style={styles.button}>
              <Text style={styles.buttonText}> Toggle Role </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={this.startCall} style={styles.button}>
              <Text style={styles.buttonText}> Start Call </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={this.endCall} style={styles.button}>
              <Text style={styles.buttonText}> End Call </Text>
            </TouchableOpacity>
          </View>
          {this._renderVideos()}
        </View>
      </View>
    );
  }

  _renderVideos = () => {
    const { joinSucceed } = this.state;
    return joinSucceed ? (
      <View style={styles.fullView}>
        {this.state.isHost ? (
          <RtcLocalView.SurfaceView
            style={styles.max}
            channelId={channelName}
            renderMode={VideoRenderMode.Hidden}
          />
        ) : (
          <></>
        )}
        {this._renderRemoteVideos()}
      </View>
    ) : null;
  };

  _renderRemoteVideos = () => {
    const { peerIds } = this.state;
    return (
      <ScrollView
        style={styles.remoteContainer}
        contentContainerStyle={styles.remoteContainerContent}
        horizontal={true}
      >
        {peerIds.map((value) => {
          return (
            <RtcRemoteView.SurfaceView
              style={styles.remote}
              uid={value}
              channelId={channelName}
              renderMode={VideoRenderMode.Hidden}
              zOrderMediaOverlay={true}
            />
          );
        })}
      </ScrollView>
    );
  };
}

const getToken = async (channelName: string, uid: number, role: number): Promise<string> => {
  const data = await RNFetchBlob.fetch('GET', `${AGORATOKENURL}?channelName=${channelName}&uid=${uid}&role=${role}`)
  const token = JSON.parse(data.data).token as string
  //console.log('THE RESULT FROM THE SERVER. ', JSON.parse(data.data).token)
  return token
}