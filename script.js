'use strict';

class Workout {
    date = new Date();
    id = String(Date.now()).slice(-10);
    clicks = 0;

    constructor(coords, duration) {
        this.coords = coords;
        this.duration = duration; // in min
    }

    _setDescription() {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        this.description = `${this.type.replace(this.type[0], this.type[0].toUpperCase())} on ${months[this.date.getMonth()]} ${this.date.getDate()}`
    }
    click() {
        this.clicks++
    }
}
class Running extends Workout {
    type = 'running';
    constructor(coords, duration, cadence) {
        super(coords, duration);
        this.cadence = cadence;
        this._setDescription();
    }

    calcPace() {
        // min/km
        this.pace = +(this.duration / this.distance).toFixed(1);
        return this.pace;
    }
}
class Cycling extends Workout {
    type = 'cycling';
    constructor(coords, duration, elevationGain) {
        super(coords, duration);
        this.elevationGain = elevationGain;
        this._setDescription();
    }

    calcSpeed() {
        // km/h
        this.speed = +(this.distance / (this.duration / 60)).toFixed(1);
        return this.speed;
    }
}

// Application 
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const labelDistance = document.querySelector('.distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sidebar = document.querySelector('.sidebar');
const bars = document.querySelector('.bars');
const time = document.querySelector('.fa-xmark');

class App {
    #map;
    #mapEvent;
    #workouts = [];
    #curLatlng;
    #distance;
    #iconCur = L.icon({
        iconUrl: 'icon.png',

        iconSize: [40, 45], // size of the icon
    });
    constructor() {
        this.#getPosition();
        form.addEventListener('submit', this.#newWorkout.bind(this));
        inputType.addEventListener('change', this.#toggleElevationField);
        containerWorkouts.addEventListener('click', this.#moveToPopup.bind(this));
        this.#activeSidebar();

        //Get data from local storage
        this.#getLocalStorage();
    }
    #getPosition() {
        if (navigator.geolocation)
            navigator.geolocation.getCurrentPosition(this.#loadMap.bind(this), () => alert('Could not get your position'));
    }
    #loadMap(pos) {
        const { latitude, longitude } = pos.coords;
        const coords = [latitude, longitude];

        this.#map = L.map('map').setView(coords, 12);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.#map);

        this.#workouts.forEach(work => {
            this.#renderWorkoutMarker(work);
        })

        this.#showCurrentPos(coords);
        this.#map.on('click', this.#showForm.bind(this));
    }
    #showCurrentPos(coords) {
        const curPos = L.marker(coords, { icon: this.#iconCur });
        this.#curLatlng = curPos.getLatLng();
        curPos.bindPopup('Your current position').addTo(this.#map).openPopup();
        setTimeout(() => curPos.closePopup(), 3000);
    }
    #showForm(mapE) {
        this.#showSidebar();
        form.classList.remove('hidden');
        inputDuration.focus();
        this.#mapEvent = mapE;

        // Show distance on form
        this.#showDistance();
    }
    #showDistance() {
        const { lat, lng } = this.#mapEvent.latlng;

        this.#distance = +(this.#curLatlng.distanceTo(L.marker([lat, lng]).getLatLng()) / 1000).toFixed(1);
        labelDistance.textContent = `${this.#distance}`
    }
    #toggleElevationField() {
        [inputCadence, inputElevation].forEach(val => val.parentElement.classList.toggle('form__row--hidden'))
    }
    #newWorkout(e) {
        e.preventDefault();

        // Get data from form
        const type = inputType.value;
        const duration = +inputDuration.value;
        const validInputs = (...inputs) => inputs.every(inp => isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0);
        const { lat, lng } = this.#mapEvent.latlng;
        let workout;

        // If running, create running object
        if (type === 'running') {
            const cadence = +inputCadence.value;
            // Check data valid
            if (!validInputs(duration, cadence) || !allPositive(duration, cadence)) return this.#showErrorToast('Input should be a positive number')
            workout = new Running([lat, lng], duration, cadence);
        }

        // If cycling, create cycling object

        if (type === 'cycling') {
            const elevation = +inputElevation.value;
            // Check valid inputs
            if (!validInputs(duration, elevation) || !allPositive(duration)) return this.#showErrorToast('Input should be a positive number')
            workout = new Cycling([lat, lng], duration, elevation)
        }

        // Add new object to worout array and add distance
        this.#workouts.push(workout);
        workout.distance = this.#distance;
        type === 'running' ? workout.calcPace() : workout.calcSpeed();
        // Render workout on map
        this.#renderWorkoutMarker(workout);
        // Render workout on list
        this.#renderWorkout(workout);
        // Hide form and clear input fields
        this.#hideForm();

        //Set local storage to all workouts
        this.#setLocalStorage();

    }
    #renderWorkoutMarker(workout) {
        const layer = L.marker(workout.coords).addTo(this.#map);
        workout.layer = layer;
        layer.bindPopup(L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
        }))
            .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`)
            .openPopup();
    }
    #moveToPopup(e) {
        if (e.target.closest('.workout')) {
            const workoutEl = e.target.closest('.workout');

            const workout = this.#workouts.find(wo => wo.id === workoutEl.dataset.id);
            this.#map.setView(workout.coords, 13, {
                animate: true,
                pan: {
                    duration: 1
                }
            })
            //using public interface
            // workout.click();
        }
    }
    #hideForm() {
        inputDuration.value = inputCadence.value = inputElevation.value = '';

        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => form.style.display = 'grid', 1000)
    }
    #renderWorkout(workout) {
        const runningOrCycling = (ic1, ic2) => workout.type === 'running' ? ic1 : ic2;
        const workoutAct = document.createElement('li');
        workoutAct.classList.add('workout', `workout--${workout.type}`);
        workoutAct.setAttribute('data-id', `${workout.id}`);
        workoutAct.innerHTML = `
        <div class="time-2">
        <i class="fa-solid fa-xmark"></i>
        </div>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${runningOrCycling('🏃‍♂️', '🚴‍♀️')}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${runningOrCycling(workout.pace, workout.speed)}</span>
          <span class="workout__unit">${runningOrCycling('min/km', 'km/h')}</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${runningOrCycling('🦶🏼', '⛰')}</span>
          <span class="workout__value">${runningOrCycling(workout.cadence, workout.elevationGain)}</span>
          <span class="workout__unit">${runningOrCycling('spm', 'm')}</span>
        </div>
        `
        form.insertAdjacentElement('afterend', workoutAct)

        workoutAct.addEventListener('click', this.#removeWorkout(workout, this));
    }
    #removeWorkout(workout, self) {
        return function (e) {
            if (e.target.closest('.time-2')) {
                e.stopPropagation();
                workout.layer.remove();
                this.remove();
                const index = self.#workouts.indexOf(workout);
                self.#workouts.splice(index, 1);
                self.#setLocalStorage();
            }
        }
    }
    #setLocalStorage() {
        const workoutsCopy = this.#workouts.map(el => {
            const obj = { ...el };
            delete obj.layer;
            return obj
        });
        workoutsCopy.length !== 0 ? localStorage.setItem('workouts', JSON.stringify(workoutsCopy))
            : localStorage.removeItem('workouts');
    }
    #getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('workouts'));

        if (!data) return;
        this.#workouts = data;
        this.#workouts.forEach(work => {
            this.#renderWorkout(work);
        })
    }
    #activeSidebar() {
        this.#showSidebar();
        bars.addEventListener('click', this.#showSidebar);
        time.addEventListener('click', this.#hideSidebar);
        document.addEventListener('keydown', e => {
            e.key === 'Escape' && this.#hideSidebar();
        })
    }
    #showSidebar() {
        sidebar.classList.remove('slide-to-left');
        sidebar.classList.add('slide-to-right');
        bars.style.display = 'none';
    }
    #hideSidebar() {
        sidebar.classList.add('slide-to-left');
        sidebar.classList.remove('slide-to-right');
        bars.style.display = 'block'
    }
    #showErrorToast(message, duration = 1500) {
        const main = document.querySelector('#toast');
        const toast = document.createElement('div');
        toast.classList.add('toast', `toast--error`)

        toast.innerHTML = `
            <div class="toast__icon">
            <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="toast__body">
            <h3 class="toast__title">Error!</h3>
            <p class="toast__msg">${message}</p>
            </div>
            <div class="toast__close">
            <i class="fas fa-times"></i>
            </div>`
        toast.style.animation = `slideInLeft ease .3s, fadeOut linear 1s ${duration / 1000}s forwards`;
        main.append(toast);

        const timer = setTimeout(() => toast.remove(), duration + 1000);
        toast.addEventListener('click', e => {
            if (e.target.closest('.toast__close')) {
                clearTimeout(timer);
                toast.remove();
            }
        })
    }
    reset() {
        localStorage.removeItem('workouts');
        location.reload();
    }
}
const app = new App();

