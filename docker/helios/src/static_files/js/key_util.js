function check_key(key) {
    try {
        let secret_key = JSON.parse(key);
        let keys = ['public_key', 'x']
        for (let i in keys) {
            if (!(keys[i] in secret_key)) {
                return false;
            }
        }

        keys = ['g', 'p', 'q', 'y']
        for (let i in keys) {
            if (!(keys[i] in secret_key['public_key'])) {
                return false;
            }
        }
        return true;
    } catch {
    }
    return false;
}