// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

const Pepr = {
  create(name: string, options: any) {
    console.log("create", name, options);
  },
  mutate(name: string, options: any) {
    console.log("mutate", name, options);
  },
};

export default Pepr;
