const road = document.querySelector<HTMLCanvasElement>('canvas#road');

if(!road) {
  throw new Error('Cannot find a \'canvas\' for the road in the current context.');
}


import Car from './car.js';


road.width = 200;
road.height = window.innerHeight;


const car = new Car(100, 100, 30, 50);
car.draw(road.getContext('2d')!);
