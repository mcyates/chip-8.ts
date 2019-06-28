export const setArray = (array: boolean[], val: boolean): boolean[] => {
	for (let i = array.length; i >= 0; --i) {
		array[i] = val;
	}
	return array;
};

export const rng = (): number => {
	return new Uint8Array([Math.floor(Math.random() & 256)])[0];
};

const utils = {
	setArray,
	rng
};

export default utils;
