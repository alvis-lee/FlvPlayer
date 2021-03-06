import { getNowTime } from '../utils';
import AudioDecoder from './audio';

export default class Decoder {
    constructor(flv) {
        this.flv = flv;
        this.ended = false;
        this.playing = false;
        this.waiting = false;
        this.animationFrameTimer = null;
        this.waitingTimer = null;
        this.currentTime = 0;
        this.lastUpdateTime = 0;

        this.video = new window.FlvplayerDecoder(flv, this);
        if (flv.options.hasAudio) {
            this.audio = new AudioDecoder(flv, this);
        } else {
            this.audio = {
                play: () => null,
                stop: () => null,
                playing: true,
                decoding: false,
            };
        }

        flv.on('ready', () => {
            if (flv.options.autoPlay) {
                this.play();
            } else {
                this.video.draw(0);
            }
        });

        flv.on('destroy', () => {
            this.pause();
        });

        flv.on('timeupdate', currentTime => {
            if (!flv.options.live && currentTime >= flv.player.duration) {
                this.pause();
            }
        });

        let isPlaying = false;
        flv.events.proxy(document, 'visibilitychange', () => {
            if (document.hidden) {
                isPlaying = this.playing;
                this.pause();
            } else if (isPlaying) {
                this.play();
            }
        });
    }

    play() {
        this.lastUpdateTime = getNowTime();
        this.video.play(this.currentTime);
        this.audio.play(this.currentTime);
        this.animationFrame();
        this.flv.emit('play');
    }

    animationFrame() {
        const { options, player, debug } = this.flv;
        this.animationFrameTimer = requestAnimationFrame(() => {
            if (this.video.playing && this.audio.playing) {
                this.ended = false;
                this.playing = true;
                this.waiting = false;
                const updateTime = getNowTime();
                this.currentTime += (updateTime - this.lastUpdateTime) / 1000;
                this.lastUpdateTime = updateTime;
                this.flv.emit('timeupdate', this.currentTime);
            } else if (player.streaming || this.video.decoding || this.audio.decoding) {
                this.ended = false;
                this.playing = true;
                this.waiting = true;
                this.flv.emit('waiting', this.currentTime);
                this.waitingTimer = setTimeout(() => {
                    debug.log('play-retry', {
                        streaming: player.streaming,
                        playing: {
                            video: this.video.playing,
                            audio: this.audio.playing,
                        },
                        decoding: {
                            video: this.video.decoding,
                            audio: this.audio.decoding,
                        },
                    });
                    this.play();
                }, options.live ? 3000 : 1000);
                return;
            } else {
                this.ended = true;
                this.playing = false;
                this.waiting = false;
                this.pause();
                this.flv.emit('ended', this.currentTime);
                if (options.loop && options.cache && !options.live) {
                    this.currentTime = 0;
                    this.play();
                    this.flv.emit('loop');
                }
                return;
            }
            this.animationFrame();
        });
    }

    pause() {
        cancelAnimationFrame(this.animationFrameTimer);
        clearTimeout(this.waitingTimer);
        this.animationFrameTimer = null;
        this.waitingTimer = null;
        this.video.stop();
        this.audio.stop();
        this.ended = false;
        this.playing = false;
        this.waiting = false;
        this.flv.emit('pause');
    }

    seeked(time) {
        const { player, options } = this.flv;
        if (!options.cache || options.live) return;
        cancelAnimationFrame(this.animationFrameTimer);
        clearTimeout(this.waitingTimer);
        this.animationFrameTimer = null;
        this.waitingTimer = null;
        this.currentTime = time;
        this.video.draw(Math.floor(time * player.frameRate));
        if (this.playing) {
            this.play();
        }
        this.flv.emit('seeked', time);
    }
}
