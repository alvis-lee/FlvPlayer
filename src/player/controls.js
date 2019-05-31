import { secondToTime, throttle, clamp } from '../utils';

export default function controls(flv, player) {
    const {
        events: { proxy },
    } = flv;

    proxy(player.$play, 'click', () => {
        player.play();
    });

    proxy(player.$pause, 'click', () => {
        player.pause();
    });

    const loadedFn = throttle(timestamp => {
        const time = clamp(timestamp / player.duration, 0, 1);
        player.$loaded.style.width = `${time * 100}%`;
    }, 500);

    flv.on('loaded', timestamp => {
        if (!flv.options.live) {
            loadedFn(timestamp);
        }
    });

    const timeupdateFn = throttle(currentTime => {
        player.$played.style.width = `${currentTime / player.duration * 100}%`;
        player.$current.innerText = secondToTime(currentTime);
    }, 500);

    flv.on('timeupdate', currentTime => {
        if (!flv.options.live) {
            timeupdateFn(currentTime);
        }
    });

    flv.on('scripMeta', () => {
        if (!flv.options.live) {
            player.$duration.innerText = secondToTime(player.duration);
        }
    });
}
